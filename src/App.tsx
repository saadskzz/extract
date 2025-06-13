import React, { useState } from 'react';
import { Search, Copy, CheckCircle, AlertCircle, ExternalLink, Loader2, Info } from 'lucide-react';

interface ExtractResponse {
  success: boolean;
  m3u8URL?: string;
  allUrls?: string[];
  count?: number;
  error?: string;
  suggestion?: string;
  details?: string;
  statusCode?: number;
  errorCode?: string;
  contentLength?: number;
  responseStatus?: number;
  htmlPreview?: string;
  contentPreview?: string;
  responsePreview?: string;
  errorType?: string;
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setResult({ success: false, error: 'Please enter a URL' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3003/api/extract-m3u8', {
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
        errorType: 'CONNECTION_ERROR'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">M3U8 Link Extractor</h1>
            <p className="text-gray-600 text-lg">Extract streaming links from any video page</p>
          </div>

          {/* Main Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                  Stream Page URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/stream-page"
                    className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
                    disabled={loading}
                  />
                  <ExternalLink className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Get m3u8 Link</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {result.success ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-green-600 mb-4">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-semibold">
                      Found {result.count} m3u8 link{result.count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Success Info */}
                  {(result.responseStatus || result.contentLength) && (
                    <div className="bg-green-50 rounded-xl p-4 mb-4">
                      <div className="flex items-center space-x-2 text-green-700 mb-2">
                        <Info className="w-4 h-4" />
                        <span className="text-sm font-medium">Request Details</span>
                      </div>
                      <div className="text-sm text-green-800 space-y-1">
                        {result.responseStatus && <p>Response Status: {result.responseStatus}</p>}
                        {result.contentLength && <p>Content Length: {result.contentLength.toLocaleString()} characters</p>}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Primary M3U8 URL:</label>
                      <button
                        onClick={() => copyToClipboard(result.m3u8URL!)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                      >
                        {copied ? (
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
                    <div className="bg-white rounded-lg p-3 border">
                      <code className="text-sm text-gray-800 break-all">{result.m3u8URL}</code>
                    </div>
                  </div>

                  {result.allUrls && result.allUrls.length > 1 && (
                    <details className="bg-gray-50 rounded-xl p-4">
                      <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                        View all {result.allUrls.length} found URLs
                      </summary>
                      <div className="space-y-2 mt-3">
                        {result.allUrls.map((url, index) => (
                          <div key={index} className="bg-white rounded-lg p-3 border">
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-gray-800 break-all flex-1 mr-2">{url}</code>
                              <button
                                onClick={() => copyToClipboard(url)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-red-600 mb-4">
                    <AlertCircle className="w-6 h-6" />
                    <span className="font-semibold">Error</span>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-red-800 font-medium mb-3">{result.error}</p>
                    
                    {result.details && (
                      <div className="mb-3">
                        <p className="text-red-700 text-sm font-medium mb-1">Details:</p>
                        <p className="text-red-700 text-sm">{result.details}</p>
                      </div>
                    )}
                    
                    {result.suggestion && (
                      <div className="mb-3">
                        <p className="text-red-700 text-sm font-medium mb-1">Suggestion:</p>
                        <p className="text-red-700 text-sm">{result.suggestion}</p>
                      </div>
                    )}

                    {/* Technical Details */}
                    {(result.errorCode || result.statusCode || result.errorType) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-red-700 text-sm font-medium">
                          Technical Details
                        </summary>
                        <div className="mt-2 text-xs text-red-600 space-y-1">
                          {result.errorCode && <p>Error Code: {result.errorCode}</p>}
                          {result.statusCode && <p>Status Code: {result.statusCode}</p>}
                          {result.errorType && <p>Error Type: {result.errorType}</p>}
                        </div>
                      </details>
                    )}

                    {/* Content Preview */}
                    {(result.htmlPreview || result.contentPreview || result.responsePreview) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-red-700 text-sm font-medium">
                          Response Preview
                        </summary>
                        <div className="mt-2 bg-red-100 rounded p-2">
                          <code className="text-xs text-red-800 break-all">
                            {result.htmlPreview || result.contentPreview || result.responsePreview}
                          </code>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Card */}
          <div className="bg-blue-50 rounded-2xl p-6 mt-6">
            <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              This tool analyzes the HTML source of streaming pages to find M3U8 playlist URLs. 
              It searches through script tags, video elements, and data attributes to locate streaming links. 
              Simply paste the URL of a page containing a video player and click "Get m3u8 Link".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;