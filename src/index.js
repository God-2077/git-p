/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Cloudflare Worker for Git HTTP Proxy with enhanced Git protocol support


async function handleRequest(request, env, ctx) {
  try {
    const url = new URL(request.url)
    
    // 提取目标Git仓库URL（支持多种格式）
    const pathSegments = url.pathname.split('/').filter(p => p)
    
    if (pathSegments.length < 3) {
      return new Response('Invalid URL format. Use /https://github.com/owner/repo or /git/https://github.com/owner/repo', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // 支持两种格式：/https://host/path 或 /git/https://host/path
    let startIndex = 0
    if (pathSegments[0] === 'git') {
      startIndex = 1
    }
    
    if (pathSegments.length < startIndex + 3) {
      return new Response('Invalid Git repository URL format', { status: 400 })
    }

    const targetProto = pathSegments[startIndex].replace(/[:]?$/, '') // 清理协议后缀
    const targetHost = pathSegments[startIndex + 1]
    const repoPath = pathSegments.slice(startIndex + 2).join('/')

    // 验证协议
    if (!['http', 'https'].includes(targetProto)) {
      return new Response('Only HTTP and HTTPS protocols are supported', { status: 400 })
    }

    const targetUrl = `${targetProto}://${targetHost}/${repoPath}${url.search}`
    
    console.log(`Proxying to: ${targetUrl}`)

    // 复制并清理请求头
    const headers = new Headers()
    for (const [key, value] of request.headers) {
      // 移除可能引起问题的头
      if (!['host', 'origin', 'referer', 'cookie', 'content-length'].includes(key.toLowerCase())) {
        headers.set(key, value)
      }
    }
    
    // 设置必要的 Git 协议头
    headers.set('Host', targetHost)
    headers.set('User-Agent', 'Git-HTTP-Proxy-Worker/1.0')
    
    // Git 协议特定处理
    if (url.pathname.includes('/info/refs')) {
      const service = url.searchParams.get('service')
      if (service) {
        headers.set('Git-Protocol', `version=2`)
        headers.set('Accept', `application/x-${service}-advertisement`)
      }
    } else if (url.pathname.includes('/git-upload-pack') || 
               url.pathname.includes('/git-receive-pack')) {
      headers.set('Content-Type', 'application/x-git-upload-pack-request')
      headers.set('Accept', 'application/x-git-upload-pack-result')
    }

    // 构建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual'
    })

    const response = await fetch(proxyRequest)
    
    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location')
      if (location) {
        try {
          const redirectUrl = new URL(location)
          // 构建新的 Worker 路径
          const newPath = `/${targetProto}://${redirectUrl.host}${redirectUrl.pathname}${redirectUrl.search}`
          return Response.redirect(newPath, response.status)
        } catch (error) {
          console.error('Redirect URL parsing error:', error)
        }
      }
    }

    // 创建代理响应
    const responseHeaders = new Headers(response.headers)
    
    // 设置 CORS 头
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', '*')
    
    // 移除可能引起问题的安全头
    responseHeaders.delete('Content-Security-Policy')
    responseHeaders.delete('X-Frame-Options')
    responseHeaders.delete('X-Content-Type-Options')
    
    // 确保内容类型正确
    if (url.pathname.includes('/info/refs')) {
      const service = url.searchParams.get('service')
      if (service) {
        responseHeaders.set('Content-Type', `application/x-${service}-advertisement`)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// 测试用例
async function testGitProxy() {
  // 测试 URL 解析
  const testUrls = [
    '/https://github.com/owner/repo.git',
    '/git/https://gitlab.com/user/project.git',
    '/https://github.com/owner/repo/info/refs?service=git-upload-pack'
  ]
  
  for (const testUrl of testUrls) {
    console.log(`Testing URL: ${testUrl}`)
    // 这里可以添加更详细的测试逻辑
  }
}


export default {
	async fetch(request, env, ctx) {
		return await handleRequest(request, env, ctx)
	},
};
