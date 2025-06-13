import React, { useState } from 'react';
import { Search, Copy, CheckCircle, AlertCircle, ExternalLink, Loader2, Info, Globe, Eye, Link } from 'lucide-react';

interface ExtractResponse {
  success: boolean;
  primaryUrl?: string;
  allUrls?: string[];
  count?: number;
  error?: string;
  suggestion?: string;
  details?: string;
  statusCode?: number;
  errorCode?: string;
  contentLength?: number;
  htmlPreview?: string;
  networkLogCount?: number;
  iframeSources?: Array<{ depth: number; src: string }>;
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setResult({ success: false, error: 'Please enter a URL' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3003/api/extract-streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data: ExtractResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to connect to the server',
        details: 'Make sure the backend server is running on port 3003',
        errorCode: 'CONNECTION_ERROR'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getUrlType = (url: string) => {
    if (url.includes('.m3u8')) return { type: 'HLS', color: 'bg-green-100 text-green-800' };
    if (url.includes('.mpd')) return { type: 'DASH', color: 'bg-blue-100 text-blue-800' };
    if (url.includes('.ts')) return { type: 'TS', color: 'bg-purple-100 text-purple-800' };
    if (url.startsWith('blob:')) return { type: 'BLOB', color: 'bg-orange-100 text-orange-800' };
    if (url.startsWith('ws')) return { type: 'WebSocket', color: 'bg-yellow-100 text-yellow-800' };
    if (url.startsWith('webrtc-stream:')) return { type: 'WebRTC', color: 'bg-red-100 text-red-800' };
    return { type: 'Stream', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl mb-6 shadow-lg">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              Stream Link Extractor
            </h1>
            <p className="text-gray-600 text-xl max-w-2xl mx-auto leading-relaxed">
              Advanced tool to extract M3U8, DASH, WebRTC, and other streaming links from any video page using deep analysis
            </p>
          </div>

          {/* Main Form */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-3">
                  Video Page URL
                </label>
                <div className="relative group">
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/video-page"
                    className="w-full px-6 py-4 pl-14 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 bg-white/50 group-hover:bg-white/80"
                    disabled={loading}
                  />
                  <Link className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Analyzing page...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6" />
                    <span>Extract Stream Links</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8">
              {result.success ? (
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 text-green-600 mb-6">
                    <CheckCircle className="w-8 h-8" />
                    <div>
                      <span className="font-bold text-xl">
                        Found {result.count} streaming link{result.count !== 1 ? 's' : ''}
                      </span>
                      <p className="text-green-700 text-sm mt-1">Successfully extracted from page content</p>
                    </div>
                  </div>

                  {/* Analysis Info */}
                  {(result.contentLength || result.networkLogCount || result.iframeSources) && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                      <div className="flex items-center space-x-2 text-green-700 mb-3">
                        <Eye className="w-5 h-5" />
                        <span className="font-semibold">Analysis Summary</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {result.contentLength && (
                          <div className="bg-white/60 rounded-xl p-3">
                            <p className="text-green-800 font-medium">Content Analyzed</p>
                            <p className="text-green-700">{result.contentLength.toLocaleString()} characters</p>
                          </div>
                        )}
                        {result.networkLogCount && (
                          <div className="bg-white/60 rounded-xl p-3">
                            <p className="text-green-800 font-medium">Network Requests</p>
                            <p className="text-green-700">{result.networkLogCount} monitored</p>
                          </div>
                        )}
                        {result.iframeSources && result.iframeSources.length > 0 && (
                          <div className="bg-white/60 rounded-xl p-3">
                            <p className="text-green-800 font-medium">Iframes Processed</p>
                            <p className="text-green-700">{result.iframeSources.length} found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Primary URL */}
                  {result.primaryUrl && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold text-blue-900">Primary Stream URL</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUrlType(result.primaryUrl).color}`}>
                            {getUrlType(result.primaryUrl).type}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.primaryUrl!)}
                          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          {copied === result.primaryUrl ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-white/80 rounded-xl p-4 border border-blue-100">
                        <code className="text-sm text-gray-800 break-all font-mono">{result.primaryUrl}</code>
                      </div>
                    </div>
                  )}

                  {/* All URLs */}
                  {result.allUrls && result.allUrls.length > 1 && (
                    <details className="bg-gray-50 rounded-2xl border border-gray-200">
                      <summary className="cursor-pointer p-6 font-semibold text-gray-800 hover:bg-gray-100 rounded-2xl transition-colors">
                        <span className="text-lg">View all {result.allUrls.length} discovered URLs</span>
                        <span className="text-sm text-gray-600 ml-2">Click to expand</span>
                      </summary>
                      <div className="px-6 pb-6 space-y-3">
                        {result.allUrls.map((streamUrl, index) => {
                          const urlInfo = getUrlType(streamUrl);
                          return (
                            <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="text-sm font-medium text-gray-700">URL #{index + 1}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${urlInfo.color}`}>
                                      {urlInfo.type}
                                    </span>
                                  </div>
                                  <code className="text-sm text-gray-800 break-all font-mono block">{streamUrl}</code>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(streamUrl)}
                                  className="flex-shrink-0 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                  title="Copy URL"
                                >
                                  {copied === streamUrl ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {/* Iframe Sources */}
                  {result.iframeSources && result.iframeSources.length > 0 && (
                    <details className="bg-purple-50 rounded-2xl border border-purple-200">
                      <summary className="cursor-pointer p-6 font-semibold text-purple-800 hover:bg-purple-100 rounded-2xl transition-colors">
                        <span className="text-lg">Iframe Sources Analyzed ({result.iframeSources.length})</span>
                      </summary>
                      <div className="px-6 pb-6 space-y-3">
                        {result.iframeSources.map((iframe, index) => (
                          <div key={index} className="bg-white rounded-xl p-4 border border-purple-200">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm font-medium text-purple-700">Depth {iframe.depth}</span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">iframe</span>
                            </div>
                            <code className="text-sm text-gray-800 break-all font-mono">{iframe.src}</code>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 text-red-600 mb-6">
                    <AlertCircle className="w-8 h-8" />
                    <div>
                      <span className="font-bold text-xl">Extraction Failed</span>
                      <p className="text-red-700 text-sm mt-1">Unable to find streaming links</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-6 border border-red-200">
                    <p className="text-red-800 font-semibold text-lg mb-4">{result.error}</p>
                    
                    {result.details && (
                      <div className="mb-4">
                        <p className="text-red-700 font-medium mb-2">Details:</p>
                        <p className="text-red-700 text-sm bg-white/60 rounded-xl p-3">{result.details}</p>
                      </div>
                    )}
                    
                    {result.suggestion && (
                      <div className="mb-4">
                        <p className="text-red-700 font-medium mb-2">Suggestion:</p>
                        <p className="text-red-700 text-sm bg-white/60 rounded-xl p-3">{result.suggestion}</p>
                      </div>
                    )}

                    {/* Technical Details */}
                    {(result.errorCode || result.statusCode) && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-red-700 font-medium hover:text-red-800">
                          Technical Details
                        </summary>
                        <div className="mt-3 bg-white/60 rounded-xl p-3 text-sm text-red-600 space-y-1">
                          {result.errorCode && <p><strong>Error Code:</strong> {result.errorCode}</p>}
                          {result.statusCode && <p><strong>Status Code:</strong> {result.statusCode}</p>}
                        </div>
                      </details>
                    )}

                    {/* Content Preview */}
                    {result.htmlPreview && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-red-700 font-medium hover:text-red-800">
                          Page Content Preview
                        </summary>
                        <div className="mt-3 bg-white/60 rounded-xl p-3">
                          <code className="text-xs text-red-800 break-all font-mono block">
                            {result.htmlPreview}
                          </code>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3 text-lg">How it works</h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                This advanced tool uses Puppeteer to render pages, intercept network requests, analyze iframes recursively, 
                and hook into WebRTC/WebSocket connections to discover all types of streaming URLs including M3U8, DASH, 
                blob URLs, and WebRTC streams.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <h3 className="font-bold text-green-900 mb-3 text-lg">Supported Formats</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-lg font-medium">HLS (.m3u8)</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg font-medium">DASH (.mpd)</span>
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-lg font-medium">TS Segments</span>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-lg font-medium">Blob URLs</span>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg font-medium">WebSocket</span>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-lg font-medium">WebRTC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;