import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";

const abarinHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: "#ff7b72" },
    { tag: tags.controlKeyword, color: "#ff7b72" },
    { tag: tags.operator, color: "#79c0ff" },
    { tag: tags.punctuation, color: "#c9d1d9" },
    { tag: tags.string, color: "#a5d6ff" },
    { tag: tags.number, color: "#79c0ff" },
    { tag: tags.bool, color: "#79c0ff" },
    { tag: tags.className, color: "#d2a8ff" },
    { tag: tags.function(tags.variableName), color: "#d2a8ff" },
    { tag: tags.variableName, color: "#c9d1d9" },
    { tag: tags.comment, color: "#8b949e", fontStyle: "italic" },
]);

const LANGUAGE_MODES = {
    "python": python,
    "javascript": javascript,
    "cpp": cpp,
    "java": java,
    "rust": rust
};

const DEFAULT_CODES = {
    "python": `def greet(name="World"):\n    print(f"Hello, {name}!")\n\ngreet("Abarin")`,
    "javascript": `function greet(name = "World") {\n    console.log(\`Hello, \${name}!\`);\n}\n\ngreet("Abarin");`,
    "cpp": `#include <iostream>\n\nint main() {\n    std::cout << "Hello, Abarin!" << std::endl;\n    return 0;\n}`,
    "java": `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Abarin!");\n    }\n}`,
    "rust": `fn main() {\n    println!("Hello, Abarin!");\n}`
};

let editor = null;
let isBooted = false;

const bootScreen = document.getElementById("boot-screen");
const workspace = document.getElementById("workspace");
const terminalOutput = document.getElementById("terminal-output");
const commandInput = document.getElementById("command-input");
const langSelector = document.getElementById("lang-selector");

function initEditor() {
    let state = EditorState.create({
        doc: DEFAULT_CODES["python"],
        extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            history(),
            python(),
            syntaxHighlighting(abarinHighlightStyle),
            highlightActiveLine(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.theme({
                "&": { color: "var(--text-primary)", backgroundColor: "transparent" }
            }, {dark: true})
        ]
    });

    editor = new EditorView({
        state,
        parent: document.getElementById("editor-container")
    });
}

function updateEditorLanguage(langName) {
    if (!editor) return;
    
    let code = DEFAULT_CODES[langName] || "";
    let langExt = LANGUAGE_MODES[langName] ? LANGUAGE_MODES[langName]() : python();

    let newState = EditorState.create({
        doc: code,
        extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            history(),
            langExt,
            syntaxHighlighting(abarinHighlightStyle),
            highlightActiveLine(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.theme({
                "&": { color: "var(--text-primary)", backgroundColor: "transparent" }
            }, {dark: true})
        ]
    });
    
    editor.setState(newState);
}

function termPrint(text, className = "output") {
    const span = document.createElement("span");
    span.className = className;
    span.innerText = text + "\n";
    terminalOutput.appendChild(span);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Ensure proper version values for Piston correctly from UI
async function executeCode() {
    const lang = langSelector.value;
    const version = langSelector.options[langSelector.selectedIndex].dataset.version;
    const code = editor.state.doc.toString();
    
    termPrint(`\n--- Executing ${lang} ---`, "sys-msg");

    try {
        const response = await fetch("https://emacs.piston.rs/api/v2/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: lang,
                version: version,
                files: [{ content: code }]
            })
        });
        
        const data = await response.json();
        
        if (data.run && data.run.stdout) termPrint(data.run.stdout, "output");
        if (data.run && data.run.stderr) termPrint(data.run.stderr, "error");
        if (data.compile && data.compile.stderr) termPrint(data.compile.stderr, "error");
        
    } catch (err) {
        termPrint(`Execution failed: ${err.message}`, "error");
    }
}

function copyCode() {
    const code = editor.state.doc.toString();
    navigator.clipboard.writeText(code);
    termPrint("Code copied to clipboard.", "sys-msg");
}

function saveCode() {
    const code = editor.state.doc.toString();
    const extRaw = langSelector.value;
    const ext = { "python": "py", "javascript": "js", "cpp": "cpp", "java": "java", "rust": "rs" }[extRaw] || "txt";
    
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abarin_source.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    termPrint(`Saved as abarin_source.${ext}`, "sys-msg");
}

function toggleLayout() {
    const isHor = workspace.classList.contains("layout-horizontal");
    if (isHor) {
        workspace.classList.remove("layout-horizontal");
        workspace.classList.add("layout-vertical");
        termPrint("Layout: Vertical", "sys-msg");
    } else {
        workspace.classList.remove("layout-vertical");
        workspace.classList.add("layout-horizontal");
        termPrint("Layout: Horizontal", "sys-msg");
    }
}

function handleCommand(cmd) {
    const rawArgs = cmd.trim().split(" ");
    const action = rawArgs[0].toLowerCase();
    
    termPrint(`> ${cmd}`, "sys-msg");
    
    switch (action) {
        case ":run": executeCode(); break;
        case ":clear": 
            terminalOutput.innerHTML = "";
            termPrint("Terminal cleared.", "sys-msg");
            break;
        case ":save": saveCode(); break;
        case ":layout": toggleLayout(); break;
        case ":theme":
            const themes = ["", "theme-blue", "theme-amber"];
            const current = document.body.className;
            let nextIndex = (themes.indexOf(current) + 1) % themes.length;
            document.body.className = themes[nextIndex];
            termPrint(`Theme toggled.`, "sys-msg");
            break;
        default:
            if (cmd.trim() !== "") termPrint(`Unknown command: ${action}`, "error");
            editor.focus();
            break;
    }
}

document.addEventListener("keydown", (e) => {
    if (!isBooted) {
        isBooted = true;
        bootScreen.classList.add("hidden");
        workspace.classList.remove("hidden");
        initEditor();
        termPrint("Terminal ready. Execute code using Piston API.", "sys-msg");
        setTimeout(() => editor.focus(), 100);
        return;
    }
});

commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        const cmd = commandInput.value;
        commandInput.value = "";
        handleCommand(cmd);
    }
});

document.getElementById("btn-run").addEventListener("click", executeCode);
document.getElementById("btn-copy").addEventListener("click", copyCode);
document.getElementById("btn-save").addEventListener("click", saveCode);
document.getElementById("btn-layout").addEventListener("click", toggleLayout);
document.getElementById("btn-clear-term").addEventListener("click", () => {
    terminalOutput.innerHTML = "";
    termPrint("Terminal cleared.", "sys-msg");
});

langSelector.addEventListener("change", (e) => {
    updateEditorLanguage(e.target.value);
    termPrint(`Switched to ${e.target.value}`, "sys-msg");
});
