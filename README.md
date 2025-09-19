# Silly Tavern Phone Simulator Extension

This extension for SillyTavern simulates a smartphone interface, allowing for immersive, interactive roleplaying scenarios with AI characters.

## How to Use

1.  **Installation:**
    *   Download the contents of this repository.
    *   Place the entire folder into the `extensions` directory of your SillyTavern installation.
    *   Restart SillyTavern.

2.  **Enabling the Extension:**
    *   Go to the Extensions tab in SillyTavern (the puzzle piece icon).
    *   Find "Phone Simulator" in the list.
    *   Make sure the "Enable" checkbox is checked.
    *   Refresh the page.

3.  **Accessing the Phone:**
    *   Once enabled, you will see a new phone icon on the right side of the screen.
    *   Click this icon to open and close the phone interface.

## How it Connects to the AI

This extension is designed to work seamlessly with the AI you have configured in SillyTavern. Here's how it works:

*   **User Actions:** When you perform an action within the phone simulator (e.g., sending a text, making a call, posting on a forum), the extension sends a specially formatted message to the AI.
*   **System Prompts:** These messages are formatted as "system prompts" that tell the AI what you've done. For example, if you send a message to a character named "Alex," the AI will receive a prompt like `(System Prompt: {{user}} sent a message to Alex: "Hello!")`.
*   **AI Response:** The AI then generates a response based on this prompt and the ongoing conversation, creating a dynamic and interactive experience. The extension parses the AI's response and displays it within the phone interface.

Essentially, the extension acts as a bridge between your actions in the phone interface and the AI, allowing for a more immersive and interactive roleplaying experience.
