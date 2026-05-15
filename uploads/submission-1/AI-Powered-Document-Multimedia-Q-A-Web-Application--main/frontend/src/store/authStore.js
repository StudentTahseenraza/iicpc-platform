// frontend/src/store/authStore.js

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,

      // =========================
      // LOGIN
      // =========================
      login: async (email, password) => {
        set({ isLoading: true })

        try {
          const formData = new URLSearchParams()

          // FastAPI OAuth2 expects username
          formData.append('username', email)
          formData.append('password', password)

          const response = await authAPI.login(formData)

          set({
            token: response.data.access_token,
            isLoading: false,
          })

          // Fetch logged-in user
          const userResponse = await authAPI.getMe()

          set({
            user: userResponse.data,
          })

          toast.success('Login successful!')

          return true
        } catch (error) {
          set({ isLoading: false })

          const errorMessage =
            error.response?.data?.detail?.[0]?.msg ||
            error.response?.data?.detail ||
            error.message ||
            'Login failed'

          toast.error(errorMessage)

          return false
        }
      },

      // =========================
      // REGISTER
      // =========================
      register: async (email, password, fullName) => {
        set({ isLoading: true })

        try {
          await authAPI.register({
            email,
            password,

            // FIXED FIELD NAME
            name: fullName,
          })

          toast.success('Registration successful! Please login.')

          set({ isLoading: false })

          return true
        } catch (error) {
          set({ isLoading: false })

          const errorMessage =
            error.response?.data?.detail?.[0]?.msg ||
            error.response?.data?.detail ||
            error.message ||
            'Registration failed'

          toast.error(errorMessage)

          return false
        }
      },

      // =========================
      // LOGOUT
      // =========================
      logout: () => {
        set({
          user: null,
          token: null,
        })

        toast.success('Logged out')
      },
    }),

    {
      name: 'auth-storage',
    }
  )
)