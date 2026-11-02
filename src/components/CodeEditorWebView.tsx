/**
 * CodeEditorWebView — CodeMirror 6 embedded in react-native-webview.
 * Loads CM6 bundles from esm.sh CDN (cached by WebView after first load).
 * Bridges content changes back to RN via postMessage.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface CodeEditorWebViewProps {
  value: string;
  onChange: (text: string) => void;
  language?: string;
  readOnly?: boolean;
  isDark?: boolean;
}

/** Detect CodeMirror language extension name from file extension */
function detectLanguage(language?: string): string {
  if (!language) return 'plaintext';
  const ext = language.toLowerCase().replace(/^\./, '');
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    python: 'python',
    rb: 'ruby',
    ruby: 'ruby',
    go: 'go',
    rs: 'rust',
    rust: 'rust',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    'c++': 'cpp',
    c: 'c',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    less: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    xml: 'xml',
    kt: 'kotlin',
    kotlin: 'kotlin',
    swift: 'swift',
    dart: 'dart',
  };
  return map[ext] || 'plaintext';
}

/** Build the full HTML page injected into WebView */
function buildEditorHtml(value: string, lang: string, isDark: boolean): string {
  // Escape content for safe injection into a JS string literal
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const theme = isDark ? 'oneDark' : 'githubLight';
  const bg = isDark ? '#1e1e2e' : '#ffffff';
  const fg = isDark ? '#cdd6f4' : '#24292f';

  // Language module map — only languages with @codemirror packages available on esm.sh
  const langModuleMap: Record<string, string> = {
    javascript: "@codemirror/lang-javascript",
    typescript: "@codemirror/lang-javascript",
    python:     "@codemirror/lang-python",
    html:       "@codemirror/lang-html",
    css:        "@codemirror/lang-css",
    json:       "@codemirror/lang-json",
    markdown:   "@codemirror/lang-markdown",
    java:       "@codemirror/lang-java",
    cpp:        "@codemirror/lang-cpp",
    c:          "@codemirror/lang-cpp",
    rust:       "@codemirror/lang-rust",
    sql:        "@codemirror/lang-sql",
    xml:        "@codemirror/lang-xml",
    go:         "@codemirror/lang-go",
    php:        "@codemirror/lang-php",
    shell:      "@codemirror/legacy-modes/mode/shell",
    yaml:       "@codemirror/legacy-modes/mode/yaml",
  };

  const hasLang = !!langModuleMap[lang];
  const langModule = langModuleMap[lang] || '';

  // Determine import strategy
  let langImport = '';
  let langExtension = 'plaintext()';
  const isLegacy = langModule.includes('legacy-modes');

  if (hasLang && !isLegacy) {
    if (lang === 'typescript') {
      langImport = `import { javascript } from '${langModule}';`;
      langExtension = 'javascript({ typescript: true })';
    } else if (lang === 'cpp' || lang === 'c') {
      langImport = `import { cpp } from '${langModule}';`;
      langExtension = 'cpp()';
    } else {
      const fnName = lang === 'json' ? 'json' : lang === 'css' ? 'css' : lang === 'html' ? 'html' : lang === 'markdown' ? 'markdown' : lang === 'python' ? 'python' : lang === 'java' ? 'java' : lang === 'rust' ? 'rust' : lang === 'sql' ? 'sql' : lang === 'xml' ? 'xml' : lang === 'go' ? 'go' : lang === 'php' ? 'php' : lang;
      langImport = `import { ${fnName} } from '${langModule}';`;
      langExtension = `${fnName}()`;
    }
  } else if (hasLang && isLegacy) {
    // Use StreamLanguage for legacy modes
    langImport = `
import { StreamLanguage } from 'https://esm.sh/@codemirror/language';
import { ${lang === 'shell' ? 'shell' : lang} } from '${langModule}';`;
    langExtension = `StreamLanguage.define(${lang === 'shell' ? 'shell' : lang})`;
  }

  const themeModule = theme === 'oneDark'
    ? `import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark';`
    : `import { githubLight } from 'https://esm.sh/thememirror@2';`;

  const themeExtension = theme === 'oneDark' ? 'oneDark' : 'githubLight';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: ${bg}; color: ${fg}; }
  #editor { height: 100vh; overflow: auto; }
  .cm-editor { height: 100%; font-size: 13px; font-family: 'Fira Code', 'Courier New', monospace; }
  .cm-editor.cm-focused { outline: none; }
  .cm-scroller { overflow: auto; }
  .cm-gutters { min-width: 40px; }
</style>
</head>
<body>
<div id="editor"></div>
<script type="module">
  import { EditorState, Compartment } from 'https://esm.sh/@codemirror/state';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from 'https://esm.sh/@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from 'https://esm.sh/@codemirror/commands';
  import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from 'https://esm.sh/@codemirror/language';
  import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from 'https://esm.sh/@codemirror/autocomplete';
  import { searchKeymap, highlightSelectionMatches } from 'https://esm.sh/@codemirror/search';
  ${themeModule}
  ${langImport}

  const languageCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();

  const initialDoc = \`${escaped}\`;

  let lastSentContent = initialDoc;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString();
      if (content !== lastSentContent) {
        lastSentContent = content;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change', content }));
      }
    }
  });

  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
    ]),
    ${themeExtension},
    languageCompartment.of(${langExtension}),
    readOnlyCompartment.of(EditorState.readOnly.of(${false})),
    updateListener,
  ];

  const view = new EditorView({
    state: EditorState.create({ doc: initialDoc, extensions }),
    parent: document.getElementById('editor'),
  });

  // Listen for messages from RN
  window.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'setContent') {
        const currentContent = view.state.doc.toString();
        if (currentContent !== msg.content) {
          lastSentContent = msg.content;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: msg.content },
          });
        }
      } else if (msg.type === 'setReadOnly') {
        view.dispatch({
          effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(msg.value)),
        });
      }
    } catch (e) {}
  });

  // Signal ready
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>`;
}

export const CodeEditorWebView: React.FC<CodeEditorWebViewProps> = ({
  value,
  onChange,
  language,
  readOnly = false,
  isDark = false,
}) => {
  const webViewRef = useRef<any>(null);
  const lang = detectLanguage(language);
  const htmlRef = useRef(buildEditorHtml(value, lang, isDark));
  const mountedRef = useRef(false);
  const lastValueRef = useRef(value);

  // Push value changes into the editor after mount
  useEffect(() => {
    if (!mountedRef.current) return;
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      webViewRef.current?.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({ type: 'setContent', content: ${JSON.stringify(value)} })
        }));
        true;
      `);
    }
  }, [value]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') {
          mountedRef.current = true;
        } else if (msg.type === 'change') {
          lastValueRef.current = msg.content;
          onChange(msg.content);
        }
      } catch (_) {}
    },
    [onChange]
  );

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlRef.current }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

