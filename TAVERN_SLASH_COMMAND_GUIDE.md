# Standard Guide for Using Tavern Slash Commands

**Document Version**: 1.0
**Objective**: To clarify the standards for using SillyTavern slash commands within the plugin, especially to distinguish the uses of `/send` and `/setinput`, ensuring that all interactions requiring an AI response are triggered correctly.

---

## 1. Background

During development, we found that certain user actions (like adding a friend or answering a call) displayed the corresponding system prompts on the phone interface but did not trigger the AI to generate subsequent plot developments. After investigation, the reason was found to be the incorrect use of the `/send` command for these actions, which did not invoke the AI generation process.

## 2. Core Command Details

### 2.1 `/send` Command

-   **Function**: The sole purpose of `/send` is to **insert a new message into the front-end chat log**.
-   **Behavior**: It **does not** send any requests to the backend and **does not** trigger the language model (LLM) for any computation or generation. It is merely a UI operation.
-   **Use Cases**:
    -   Displaying purely client-side information that does not require an AI response.
    -   (In the Phone Simulator plugin, this scenario is **almost non-existent**, as nearly all system prompts imply a state change that the AI needs to be aware of and react to.)

**Example (Incorrect Usage):**
```javascript
// This will only show a line of text to the user in the chat box, but the AI will be completely unaware of it.
TavernHelper_API.triggerSlash('/send (System Prompt: {{user}} answered a call from Xia Shi.)');
```

### 2.2 `/setinput` + `SillyTavern_API.generate()` (Standard Procedure)

-   **Function**: This is the standard, reliable method for triggering a complete AI plot progression.
-   **Behavior**:
    1.  `await triggerSlash('/setinput ...')`: This command places the text content within the parentheses (usually a system prompt) into SillyTavern's main input box. `await` ensures this operation is completed before proceeding.
    2.  `SillyTavern_API.generate()`: This function immediately triggers a form submission, sending the current chat context (including the prompt just set with `/setinput`) to the AI for processing.
-   **Use Cases**:
    -   **All** user actions or system events that require the AI to be aware and generate a response.
    -   Including but not limited to: answering/rejecting calls, adding friends, speaking during a call, requesting new Moments/posts/live stream lists, performing searches, etc.

**Example (Correct Usage):**
```javascript
const prompt = `(System Prompt: {{user}} answered a call from Xia Shi.)`;
// 1. Place the system prompt into the input box
await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`);
// 2. Trigger AI generation
SillyTavern_API.generate();
```
**Note**: If the content passed to `/setinput` is a string containing spaces, it is best to use `JSON.stringify()` to ensure it is treated as a single argument.

## 3. Development Standards

-   **Mandatory Rule**: In all future development of the Phone Simulator plugin, the combination of `/setinput` + `SillyTavern_API.generate()` **must** be used to handle all events that require an AI response.
-   **Prohibited Usage**: Unless there is a very specific and clear reason, the use of `/send` alone or in the form of `/send ... | /trigger` to trigger plot events is **prohibited**. Adhering to the standard procedure greatly improves code readability and reliability.

By following this guide, we can fundamentally avoid the serious bug of "unresponsive interactions" and ensure the plugin provides a smooth, coherent, and immersive experience.
