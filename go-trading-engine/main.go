package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "sort"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

// Order types
type Order struct {
    ID        int     `json:"id"`
    Type      string  `json:"type"`
    Price     float64 `json:"price"`
    Quantity  float64 `json:"quantity"`
    RequestID string  `json:"requestId"`
    Timestamp int64   `json:"timestamp"`
}

type OrderBook struct {
    Bids []Order `json:"bids"`
    Asks []Order `json:"asks"`
    mu   sync.RWMutex
}

type Trade struct {
    TradeID   int     `json:"tradeId"`
    OrderID   int     `json:"orderId"`
    Price     float64 `json:"price"`
    Quantity  float64 `json:"quantity"`
    Timestamp int64   `json:"timestamp"`
}

var (
    orderBook   = &OrderBook{Bids: []Order{}, Asks: []Order{}}
    orderID     = 0
    tradeID     = 0
    totalOrders = 0
    upgrader    = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool { return true },
    }
)

// Health check handler
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status":    "ok",
        "timestamp": time.Now().Unix(),
        "uptime":    time.Now().Unix(),
    })
}

// Order handler
func orderHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var order Order
    if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    startTime := time.Now()
    order.ID = nextOrderID()
    order.Timestamp = startTime.UnixNano()

    processOrder(&order)

    response := map[string]interface{}{
        "orderId":   order.ID,
        "status":    "accepted",
        "price":     order.Price,
        "quantity":  order.Quantity,
        "latency":   time.Since(startTime).Milliseconds(),
        "requestId": order.RequestID,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// OrderBook handler
func orderBookHandler(w http.ResponseWriter, r *http.Request) {
    orderBook.mu.RLock()
    defer orderBook.mu.RUnlock()

    response := map[string]interface{}{
        "bids":       orderBook.Bids,
        "asks":       orderBook.Asks,
        "bidCount":   len(orderBook.Bids),
        "askCount":   len(orderBook.Asks),
        "totalOrders": totalOrders,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// Metrics handler
func metricsHandler(w http.ResponseWriter, r *http.Request) {
    orderBook.mu.RLock()
    defer orderBook.mu.RUnlock()

    response := map[string]interface{}{
        "totalOrdersProcessed": totalOrders,
        "activeBids":           len(orderBook.Bids),
        "activeAsks":           len(orderBook.Asks),
        "bestBid":              getBestBid(),
        "bestAsk":              getBestAsk(),
        "spread":               getSpread(),
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// WebSocket handler
func websocketHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Print("Upgrade failed:", err)
        return
    }
    defer conn.Close()

    clientID := fmt.Sprintf("%d", time.Now().UnixNano())
    log.Printf("Client %s connected", clientID)

    // Send connection confirmation
    conn.WriteJSON(map[string]interface{}{
        "type":      "connection_ack",
        "clientId":  clientID,
        "status":    "connected",
        "timestamp": time.Now().Unix(),
    })

    for {
        var order Order
        err := conn.ReadJSON(&order)
        if err != nil {
            log.Printf("Client %s disconnected", clientID)
            break
        }

        startTime := time.Now()
        order.ID = nextOrderID()
        order.Timestamp = startTime.UnixNano()

        processOrder(&order)

        response := map[string]interface{}{
            "orderId":    order.ID,
            "status":     "filled",
            "price":      order.Price,
            "quantity":   order.Quantity,
            "latency":    time.Since(startTime).Milliseconds(),
            "requestId":  order.RequestID,
            "processedAt": time.Now().Unix(),
        }

        if err := conn.WriteJSON(response); err != nil {
            log.Printf("Write failed: %v", err)
            break
        }
    }
}

func processOrder(order *Order) {
    orderBook.mu.Lock()
    defer orderBook.mu.Unlock()

    totalOrders++

    if order.Type == "BUY" {
        // Match against asks
        remainingQty := order.Quantity
        for i := 0; i < len(orderBook.Asks) && remainingQty > 0; i++ {
            ask := &orderBook.Asks[i]
            if order.Price >= ask.Price {
                tradeQty := min(remainingQty, ask.Quantity)
                ask.Quantity -= tradeQty
                remainingQty -= tradeQty
                tradeID++
            } else {
                break
            }
        }

        // Remove filled asks
        newAsks := []Order{}
        for _, ask := range orderBook.Asks {
            if ask.Quantity > 0 {
                newAsks = append(newAsks, ask)
            }
        }
        orderBook.Asks = newAsks

        // Add remaining to bids
        if remainingQty > 0 {
            order.Quantity = remainingQty
            orderBook.Bids = append(orderBook.Bids, *order)
            sort.Slice(orderBook.Bids, func(i, j int) bool {
                return orderBook.Bids[i].Price > orderBook.Bids[j].Price
            })
        }
    } else if order.Type == "SELL" {
        // Match against bids
        remainingQty := order.Quantity
        for i := 0; i < len(orderBook.Bids) && remainingQty > 0; i++ {
            bid := &orderBook.Bids[i]
            if order.Price <= bid.Price {
                tradeQty := min(remainingQty, bid.Quantity)
                bid.Quantity -= tradeQty
                remainingQty -= tradeQty
                tradeID++
            } else {
                break
            }
        }

        // Remove filled bids
        newBids := []Order{}
        for _, bid := range orderBook.Bids {
            if bid.Quantity > 0 {
                newBids = append(newBids, bid)
            }
        }
        orderBook.Bids = newBids

        // Add remaining to asks
        if remainingQty > 0 {
            order.Quantity = remainingQty
            orderBook.Asks = append(orderBook.Asks, *order)
            sort.Slice(orderBook.Asks, func(i, j int) bool {
                return orderBook.Asks[i].Price < orderBook.Asks[j].Price
            })
        }
    }

    // Limit order book size
    if len(orderBook.Bids) > 100 {
        orderBook.Bids = orderBook.Bids[:100]
    }
    if len(orderBook.Asks) > 100 {
        orderBook.Asks = orderBook.Asks[:100]
    }
}

func getBestBid() float64 {
    if len(orderBook.Bids) > 0 {
        return orderBook.Bids[0].Price
    }
    return 0
}

func getBestAsk() float64 {
    if len(orderBook.Asks) > 0 {
        return orderBook.Asks[0].Price
    }
    return 0
}

func getSpread() float64 {
    bestBid := getBestBid()
    bestAsk := getBestAsk()
    if bestBid > 0 && bestAsk > 0 {
        return bestAsk - bestBid
    }
    return 0
}

func nextOrderID() int {
    orderID++
    return orderID
}

func min(a, b float64) float64 {
    if a < b {
        return a
    }
    return b
}

func main() {
    // HTTP routes
    http.HandleFunc("/health", healthHandler)
    http.HandleFunc("/order", orderHandler)
    http.HandleFunc("/orderbook", orderBookHandler)
    http.HandleFunc("/metrics", metricsHandler)
    http.HandleFunc("/ws", websocketHandler)

    port := ":8080"
    log.Printf("🚀 Go Trading Engine running on port %s", port)
    log.Printf("📡 HTTP: http://localhost%s", port)
    log.Printf("🔌 WebSocket: ws://localhost%s/ws", port)
    log.Printf("🏥 Health: http://localhost%s/health", port)

    if err := http.ListenAndServe(port, nil); err != nil {
        log.Fatal("Server failed:", err)
    }
}