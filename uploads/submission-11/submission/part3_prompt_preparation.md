Part 3: Prompt Preparation

Repository: https://github.com/FoundationAgents/MetaGPT

Selected Pull Request: PR #1450

Link: https://github.com/FoundationAgents/MetaGPT/pull/1450

3.1.1 Repository Context

The MetaGPT framework is like a simulated software company. It uses AI agents to do jobs like product managers, architects, engineers and project managers. These AI agents work together to complete tasks.

When you give MetaGPT an instruction it creates a plan for the project, including how the work will be done and what code is needed. This framework is about making software development easier using AI systems.

MetaGPT is for people who want to try generating software and working with AI agents. It helps tasks and makes it easier for AI agents to work together.

The repository is about automating workflows making software development easier and getting AI agents to work together smoothly. It looks at how multiple AI systems can communicate and work together.

The framework uses a way of managing tasks and roles to get AI agents to work together.

3.1.2 Request Description

This pull request makes it easier for AI agents in MetaGPT to talk to each other and work together. Before some tasks were not handled well. This caused problems. The pull request adds checks to make sure tasks are done correctly and that AI agents are talking to each other properly.

Now the workflow is more controlled and stable. The changes make sure that AI agents are working together smoothly and that tasks are done in the order.

The pull request also makes the workflow more reliable when multiple AI agents are working together.

3.1.3 Acceptance Criteria

When multiple AI agents are working on tasks the workflow should do the tasks in the order.

The system should check that everything is ready before moving on to the step.

The workflow should not fail if an AI agent does not respond correctly.

The system should be able to handle AI agents working together at the same time.

The logs should show what is happening with the tasks and the workflow.

The new workflow should not. Repeat tasks.

The existing features of MetaGPT should still work after the update.

3.1.4 Edge Cases

Edge Case 1

If an AI agent has a problem the workflow should not stop. It should keep going.

Edge Case 2

If multiple AI agents are working on tasks at the time the workflow should keep the right order.

Edge Case 3

If there is a delay the workflow should not move on to the task until it is ready.

Edge Case 4

If there is a problem with the workflow the system should log the issue. Not let the workflow continue.

3.1.5 Initial Prompt

You are working on the MetaGPT repository. Your task is to make the workflow better and improve how AI agents talk to each other. The current workflow has problems with tasks and communication between AI agents. You need to update the workflow to make it more reliable and stable.

Requirements:

Improve how AI agents talk to each other.

Make sure tasks are done in the order.

Add checks to make sure everything is ready before moving on.

Prevent problems during task processing.

Make the workflow more stable.

Make sure incomplete or incorrect responses from AI agents do not cause problems.

Keep the existing MetaGPT workflow structure.

Acceptance Criteria:

Tasks should be done in the order.

The system should check that everything is ready before moving on.

Incorrect responses from AI agents should be handled safely.

The system should be able to handle AI agents working together at the same time.

The existing workflow features should still work.

Edge Cases:

Incomplete responses from AI agents.

Delays during task processing.

Multiple tasks being worked on at the time.

Workflow transitions.

Testing Requirements:

Add or update tests for the workflow.

Test how the workflow handles AI agents working together.

Check that AI agents are working together smoothly.

Make sure incorrect responses from AI agents are handled safely.

Ensure the existing workflow features still work.

The goal is to make the workflow more consistent, reliable and stable while keeping the MetaGPT framework intact.

Integrity Declaration

I declare that all written content in this assessment is my work created without the use of AI language models or automated writing tools. All technical analysis and documentation reflects my understanding. Has been written in my own words.

