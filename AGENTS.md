# lipcoding

This repository contains a web application that is used to improve personal productivity.

## Golden rules

- Testing core features e2e is important. Try to automate e2e tests that are critical for this web application, do not test that are prone to change.

- Consider the following judgement creteria:

1. Effective Use of Copilot SDK — Weight: 25%

Does the Copilot SDK play a core role in the app's value? Evaluation focuses on the quality and appropriateness of prompt/agent design, tool calling, context handling, and streaming—prioritizing depth over the sheer number of features.

2. Productivity Impact & Problem Fit — Weight: 18%

Does it solve a realistic, well-defined productivity problem while delivering tangible, proven benefits to a clearly defined target audience?

3. Azure AI & Cloud Integration — Weight: 18%

Evaluates the meaningfulness of the Azure cloud utilization. Top scores are awarded when the AI/model layer operates on Microsoft Foundry or Azure OpenAI. Bonus points are given for cloud-native practices, while points are deducted for merely shoehorning in Azure services.

4. Functionality & Technical Execution — Weight: 16%

Does the application function end-to-end? Evaluation covers code quality, architecture, error handling, performance, and platform-appropriate implementation (native, cross-platform, or responsive web).

5. User Experience & Workflow Design — Weight: 12%

Evaluates UI that minimizes user friction, natural AI integration, graceful handling of latency/errors/transparency, accessibility, and design that ensures the user retains control.

6. Responsible AI, Security & Trust — Weight: 6%

Evaluates transparency of AI output, human-in-the-loop verification for risky actions, data privacy, hallucination mitigation, awareness of prompt injection, and secure handling of secrets.

7. Innovation & Originality — Weight: 5%

Evaluates how AI is applied in a novel and creative way to enhance productivity, rather than simply replicating existing services or tools.

- In this competition, users will not be able to review all the code. Make sure to provide logging and other observability features so that users can track the progress and debug easily