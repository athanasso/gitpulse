import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { ThemePalette } from '../constants/theme';
import { DeepLinkService } from '../services/DeepLinkService';

interface MarkdownWebViewProps {
  htmlContent: string;
  colors: ThemePalette;
  isLoading?: boolean;
  emptyMessage?: string;
  isExpanded?: boolean;
  maxCollapsedHeight?: number;
  style?: StyleProp<ViewStyle>;
}

const INJECTED_HEIGHT_JS = `
(function() {
  function getDocHeight() {
    var body = document.body;
    var html = document.documentElement;
    return Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.clientHeight : 0,
      html ? html.scrollHeight : 0,
      html ? html.offsetHeight : 0
    );
  }
  function sendHeight() {
    var h = getDocHeight();
    if (h > 0 && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
    }
  }
  if (window.ResizeObserver && document.body) {
    try {
      new ResizeObserver(sendHeight).observe(document.body);
    } catch(e) {}
  }
  window.addEventListener('load', sendHeight);
  setTimeout(sendHeight, 60);
  setTimeout(sendHeight, 250);
  setTimeout(sendHeight, 800);
  setTimeout(sendHeight, 2000);
})();
true;
`;

const buildHtmlDoc = (html: string, colors: ThemePalette) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background-color: transparent;
      color: ${colors.textPrimary};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
    }
    .markdown-body {
      padding: 4px 2px 14px 2px;
      color: ${colors.textPrimary};
    }
    a {
      color: ${colors.primary};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 18px;
      margin-bottom: 10px;
      font-weight: 600;
      line-height: 1.25;
      color: ${colors.textPrimary};
    }
    h1 {
      font-size: 1.6em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${colors.cardBorder};
    }
    h2 {
      font-size: 1.3em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid ${colors.cardBorder};
    }
    h3 { font-size: 1.12em; }
    h4 { font-size: 1.0em; }
    p, blockquote, ul, ol, dl, table, pre {
      margin-top: 0;
      margin-bottom: 12px;
    }
    ul, ol {
      padding-left: 20px;
    }
    li + li {
      margin-top: 4px;
    }
    li > p {
      margin-top: 6px;
      margin-bottom: 0;
    }
    blockquote {
      padding: 4px 12px;
      color: ${colors.textSecondary};
      border-left: 3px solid ${colors.primary};
      margin: 0 0 12px 0;
      background-color: ${colors.backgroundElevated || 'transparent'};
      border-radius: 0 4px 4px 0;
    }
    hr {
      height: 1px;
      padding: 0;
      margin: 18px 0;
      background-color: ${colors.cardBorder};
      border: 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 85%;
      margin: 0;
      padding: 0.2em 0.4em;
      border-radius: 4px;
      background-color: ${colors.codeBackground};
      border: 1px solid ${colors.codeBorder};
      color: ${colors.textPrimary};
    }
    pre {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 85%;
      line-height: 1.45;
      padding: 12px;
      overflow-x: auto;
      border-radius: 8px;
      background-color: ${colors.codeBackground};
      border: 1px solid ${colors.codeBorder};
    }
    pre code {
      padding: 0;
      margin: 0;
      background-color: transparent;
      border: 0;
      white-space: pre;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      margin-bottom: 14px;
    }
    table th, table td {
      padding: 6px 10px;
      border: 1px solid ${colors.cardBorder};
      font-size: 13px;
    }
    table th {
      font-weight: 600;
      background-color: ${colors.cardElevated};
      color: ${colors.textPrimary};
    }
    table td {
      color: ${colors.textPrimary};
    }
    table tr:nth-child(2n) {
      background-color: ${colors.backgroundElevated};
    }
    img {
      max-width: 100%;
      height: auto;
      box-sizing: border-box;
    }
    p img, a img {
      vertical-align: middle;
    }
    .task-list-item {
      list-style-type: none;
    }
    .task-list-item-checkbox {
      margin: 0 0.2em 0.25em -1.2em;
      vertical-align: middle;
    }
    .anchor {
      display: none;
    }
    svg {
      fill: currentColor;
    }
  </style>
</head>
<body class="markdown-body">
  ${html}
</body>
</html>`;

export const MarkdownWebView: React.FC<MarkdownWebViewProps> = ({
  htmlContent,
  colors,
  isLoading = false,
  emptyMessage = 'No README.md found in this repository.',
  isExpanded = true,
  maxCollapsedHeight,
  style,
}) => {
  const [contentHeight, setContentHeight] = useState<number>(180);

  const fullHtml = useMemo(() => {
    if (!htmlContent || !htmlContent.trim()) return '';
    return buildHtmlDoc(htmlContent, colors);
  }, [htmlContent, colors]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && typeof data.height === 'number') {
        setContentHeight(Math.max(data.height, 60));
      }
    } catch {
      // Ignore non-json messages
    }
  };

  const handleShouldStartLoad = (request: WebViewNavigation) => {
    if (
      !request.url ||
      request.url === 'about:blank' ||
      request.url.startsWith('data:')
    ) {
      return true;
    }
    if (
      request.url.startsWith('http://') ||
      request.url.startsWith('https://') ||
      request.url.startsWith('gitpulse://')
    ) {
      const parsed = DeepLinkService.parseUrl(request.url);
      if (parsed) {
        DeepLinkService.handleIncomingUrl(request.url);
        return false;
      }
      Linking.openURL(request.url).catch(() => {});
      return false;
    }
    if (request.url.startsWith('mailto:')) {
      Linking.openURL(request.url).catch(() => {});
      return false;
    }
    return true;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Rendering README...
        </Text>
      </View>
    );
  }

  if (!htmlContent || !htmlContent.trim()) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const effectiveHeight =
    !isExpanded && maxCollapsedHeight
      ? Math.min(contentHeight, maxCollapsedHeight)
      : contentHeight;

  return (
    <View
      style={[
        styles.container,
        { height: effectiveHeight, overflow: 'hidden' },
        style,
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: fullHtml }}
        injectedJavaScript={INJECTED_HEIGHT_JS}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={[styles.webView, { height: contentHeight }]}
        containerStyle={styles.webViewContainer}
        opaque={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  webView: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  webViewContainer: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

