/**
 * CodeEditorWebView — High-performance, zero-fail in-app mobile code editor.
 * Instant 0ms offline-first fallback with line numbers, indentation, undo/redo,
 * progressively enhanced with Ace Editor when online.
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

/** Map file extension to Ace syntax mode */
function getAceMode(ext?: string): string {
  if (!ext) return 'text';
  const clean = ext.toLowerCase().replace(/^\./, '');
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    python: 'python',
    rb: 'ruby',
    ruby: 'ruby',
    go: 'golang',
    rs: 'rust',
    rust: 'rust',
    java: 'java',
    cs: 'csharp',
    cpp: 'c_cpp',
    'c++': 'c_cpp',
    c: 'c_cpp',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    sh: 'sh',
    bash: 'sh',
    zsh: 'sh',
    sql: 'sql',
    xml: 'xml',
    kt: 'kotlin',
    kotlin: 'kotlin',
    swift: 'swift',
    dart: 'dart',
  };
  return map[clean] || 'text';
}

function buildHtml(value: string, language: string, isDark: boolean): string {
  const aceMode = getAceMode(language);
  const bg = isDark ? '#121620' : '#ffffff';
  const fg = isDark ? '#e6edf3' : '#24292f';
  const gutterBg = isDark ? '#0d1117' : '#f6f8fa';
  const gutterFg = isDark ? '#6e7681' : '#8c959f';
  const borderCol = isDark ? '#30363d' : '#d0d7de';
  const barBg = isDark ? '#161b22' : '#f6f8fa';
  const btnBg = isDark ? '#21262d' : '#eaeef2';
  const btnFg = isDark ? '#c9d1d9' : '#24292f';

  // Safely embed initial data as JSON
  const safeJson = JSON.stringify({ value, language, isDark, aceMode }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: ${bg};
    color: ${fg};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    font-size: 13px;
  }
  #root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
  }
  /* Mobile Toolbar */
  #toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: ${barBg};
    border-bottom: 1px solid ${borderCol};
    flex-shrink: 0;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tool-group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .btn {
    background: ${btnBg};
    color: ${btnFg};
    border: 1px solid ${borderCol};
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .btn:active {
    opacity: 0.6;
  }
  .status-badge {
    font-size: 11px;
    color: ${gutterFg};
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 4px;
  }
  /* Main Editor Area */
  #editor-container {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  /* Fallback Editor (0ms offline-first) */
  #fallback-editor {
    display: flex;
    width: 100%;
    height: 100%;
    background: ${bg};
    position: absolute;
    top: 0;
    left: 0;
  }
  #gutter {
    width: 44px;
    background: ${gutterBg};
    color: ${gutterFg};
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 12px;
    line-height: 20px;
    text-align: right;
    padding: 10px 8px 10px 4px;
    border-right: 1px solid ${borderCol};
    user-select: none;
    overflow: hidden;
    flex-shrink: 0;
  }
  #textarea {
    flex: 1;
    height: 100%;
    background: transparent;
    color: ${fg};
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 12px;
    line-height: 20px;
    padding: 10px;
    border: none;
    outline: none;
    resize: none;
    tab-size: 2;
    white-space: pre;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
  /* Ace Editor Host */
  #ace-editor {
    display: none;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    font-size: 12px;
  }
</style>
</head>
<body>
<div id="root">
  <div id="toolbar">
    <div class="tool-group">
      <button class="btn" id="btn-undo" title="Undo">↶ Undo</button>
      <button class="btn" id="btn-redo" title="Redo">↷ Redo</button>
      <button class="btn" id="btn-tab" title="Indent 2 spaces">⇥ Tab</button>
      <button class="btn" id="btn-wrap" title="Toggle wrap">Wrap</button>
    </div>
    <div class="tool-group">
      <button class="btn" id="btn-font-dec" title="Decrease font">A-</button>
      <button class="btn" id="btn-font-inc" title="Increase font">A+</button>
      <span class="status-badge" id="cursor-pos">Ln 1, Col 1</span>
    </div>
  </div>

  <div id="editor-container">
    <!-- Immediate Zero-Latency Fallback Editor -->
    <div id="fallback-editor">
      <div id="gutter">1</div>
      <textarea id="textarea" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>

    <!-- Ace Editor container -->
    <div id="ace-editor"></div>
  </div>
</div>

<script type="application/json" id="initial-data">${safeJson}</script>

<script>
  (function() {
    var initialData = {};
    try {
      initialData = JSON.parse(document.getElementById('initial-data').textContent || '{}');
    } catch(e) {}

    var rawValue = initialData.value || '';
    var isDark = !!initialData.isDark;
    var aceMode = initialData.aceMode || 'text';
    var isAceActive = false;
    var aceInstance = null;
    var fontSize = 12;
    var isWrapping = false;

    // Elements
    var textarea = document.getElementById('textarea');
    var gutter = document.getElementById('gutter');
    var fallback = document.getElementById('fallback-editor');
    var aceDiv = document.getElementById('ace-editor');
    var cursorPos = document.getElementById('cursor-pos');

    // Undo stack for fallback
    var undoStack = [rawValue];
    var undoIndex = 0;

    // ── 1. Initialize Fallback Editor Instantly ──────────────────────────────
    textarea.value = rawValue;
    updateGutter(rawValue);

    function updateGutter(text) {
      var lines = text.split('\\n').length;
      var numbers = [];
      for (var i = 1; i <= lines; i++) {
        numbers.push(i);
      }
      gutter.innerHTML = numbers.join('<br>');
    }

    // Sync scroll between gutter and textarea
    textarea.addEventListener('scroll', function() {
      gutter.scrollTop = textarea.scrollTop;
    });

    // Track cursor position in fallback
    function updateCursorInfo() {
      if (isAceActive && aceInstance) {
        var pos = aceInstance.getCursorPosition();
        cursorPos.textContent = 'Ln ' + (pos.row + 1) + ', Col ' + (pos.column + 1);
        return;
      }
      var selStart = textarea.selectionStart;
      var textBefore = textarea.value.substring(0, selStart);
      var lines = textBefore.split('\\n');
      var row = lines.length;
      var col = lines[lines.length - 1].length + 1;
      cursorPos.textContent = 'Ln ' + row + ', Col ' + col;
    }

    textarea.addEventListener('keyup', updateCursorInfo);
    textarea.addEventListener('click', updateCursorInfo);
    textarea.addEventListener('select', updateCursorInfo);

    // Notify React Native of changes
    function notifyChange(content) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change', content: content }));
      }
    }

    // Fallback Input Handler
    textarea.addEventListener('input', function() {
      var content = textarea.value;
      updateGutter(content);
      updateCursorInfo();
      // Manage undo stack
      if (content !== undoStack[undoIndex]) {
        undoStack = undoStack.slice(0, undoIndex + 1);
        undoStack.push(content);
        if (undoStack.length > 50) undoStack.shift();
        undoIndex = undoStack.length - 1;
      }
      notifyChange(content);
    });

    // Tab key handler in textarea
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    });

    // ── 2. Toolbar Actions ──────────────────────────────────────────────────
    document.getElementById('btn-undo').addEventListener('click', function() {
      if (isAceActive && aceInstance) {
        aceInstance.undo();
      } else if (undoIndex > 0) {
        undoIndex--;
        textarea.value = undoStack[undoIndex];
        updateGutter(textarea.value);
        notifyChange(textarea.value);
      }
    });

    document.getElementById('btn-redo').addEventListener('click', function() {
      if (isAceActive && aceInstance) {
        aceInstance.redo();
      } else if (undoIndex < undoStack.length - 1) {
        undoIndex++;
        textarea.value = undoStack[undoIndex];
        updateGutter(textarea.value);
        notifyChange(textarea.value);
      }
    });

    document.getElementById('btn-tab').addEventListener('click', function() {
      if (isAceActive && aceInstance) {
        aceInstance.indent();
      } else {
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
      }
    });

    document.getElementById('btn-wrap').addEventListener('click', function() {
      isWrapping = !isWrapping;
      this.style.borderColor = isWrapping ? '#388bfd' : '';
      if (isAceActive && aceInstance) {
        aceInstance.getSession().setUseWrapMode(isWrapping);
      } else {
        textarea.style.whiteSpace = isWrapping ? 'pre-wrap' : 'pre';
      }
    });

    document.getElementById('btn-font-inc').addEventListener('click', function() {
      fontSize = Math.min(22, fontSize + 1);
      applyFontSize();
    });

    document.getElementById('btn-font-dec').addEventListener('click', function() {
      fontSize = Math.max(10, fontSize - 1);
      applyFontSize();
    });

    function applyFontSize() {
      textarea.style.fontSize = fontSize + 'px';
      gutter.style.fontSize = fontSize + 'px';
      if (isAceActive && aceInstance) {
        aceInstance.setFontSize(fontSize + 'px');
      }
    }

    // ── 3. Progressive Ace Enhancement ─────────────────────────────────────
    window.initAce = function() {
      if (typeof ace === 'undefined') return;
      try {
        ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/');

        aceInstance = ace.edit('ace-editor');
        aceInstance.setTheme(isDark ? 'ace/theme/one_dark' : 'ace/theme/chrome');
        aceInstance.getSession().setMode('ace/mode/' + aceMode);
        aceInstance.setValue(textarea.value, -1);
        aceInstance.setFontSize(fontSize + 'px');
        aceInstance.setShowPrintMargin(false);
        aceInstance.getSession().setUseWrapMode(isWrapping);
        aceInstance.getSession().setTabSize(2);
        aceInstance.getSession().setUseSoftTabs(true);

        aceInstance.on('change', function() {
          var val = aceInstance.getValue();
          textarea.value = val;
          notifyChange(val);
        });

        aceInstance.selection.on('changeCursor', updateCursorInfo);

        // Switch visible editor
        fallback.style.display = 'none';
        aceDiv.style.display = 'block';
        aceInstance.resize();
        isAceActive = true;
      } catch(e) {
        console.warn('Ace init error, fallback active', e);
      }
    };

    // ── 4. React Native Bridge Listeners ───────────────────────────────────
    window.addEventListener('message', function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.type === 'setContent') {
          var current = isAceActive && aceInstance ? aceInstance.getValue() : textarea.value;
          if (current !== msg.content) {
            if (isAceActive && aceInstance) {
              aceInstance.setValue(msg.content, -1);
            } else {
              textarea.value = msg.content;
              updateGutter(msg.content);
            }
          }
        }
      } catch(e) {}
    });

    // Notify RN component ready
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  })();
</script>

<!-- Asynchronously load Ace Editor without blocking fallback -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/ace.js" async onload="initAce()"></script>
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
  const mountedRef = useRef(false);
  const lastValueRef = useRef(value);

  // Generate HTML with current value and settings
  const htmlContent = useRef(buildHtml(value, language || '', isDark)).current;

  // Sync value changes from parent after mount
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
          if (lastValueRef.current) {
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({ type: 'setContent', content: ${JSON.stringify(lastValueRef.current)} })
              }));
              true;
            `);
          }
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
        source={{ html: htmlContent }}
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
