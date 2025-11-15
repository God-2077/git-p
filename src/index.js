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
    const pathSegments = url.pathname.split('/').filter(p => p)
    
    // 处理GitHub特定路由 (/gh/)
    if (pathSegments[0] === 'gh') {
      return await handleGitHubRoute(request, pathSegments.slice(1))
    }
    
    // 处理Git代理路由 (/git/)
    if (pathSegments[0] === 'git') {
      return await handleGitRoute(request, pathSegments.slice(1))
    }

	// 处理根路径（/）
    if (pathSegments.length === 0) {
		const text = `GitHub & Git 代理 Worker API 使用教程
=====================================

简介
----
这是一个Cloudflare Worker代理服务，专门用于代理GitHub和Git仓库的请求。支持GitHub特定功能（如下载、原始文件、分支归档）和通用Git协议。

基本URL结构
----------
所有请求都基于您的Worker部署地址，格式为：
https://your-worker.your-subdomain.workers.dev/{路由前缀}/{目标URL}

路由类型
-------

1. GitHub专用路由 (/gh/)
   - 专门处理GitHub.com的请求
   - 支持智能路径转换（如blob转raw）
   - 自动处理分支/标签归档

2. Git通用路由 (/git/)
   - 处理任意Git仓库的请求
   - 支持Git协议操作（info/refs, git-upload-pack等）

API端点详解
----------

GitHub路由 (/gh/) 支持以下模式：

1. 仓库主页 → 主分支归档
   /gh/https://github.com/owner/repo
   返回：master分支的zip归档

2. 分支/标签页面 → 对应分支归档
   /gh/https://github.com/owner/repo/tree/branch-name
   返回：指定分支的zip归档

3. 文件页面 → 原始文件
   /gh/https://github.com/owner/repo/blob/branch/path/to/file
   返回：文件的原始内容（自动blob转raw）

4. Releases下载
   /gh/https://github.com/owner/repo/releases/download/tag/file
   返回：直接代理下载

5. Releases标签页面 → 标签归档
   /gh/https://github.com/owner/repo/releases/tag/tag-name
   返回：指定标签的zip归档

6. 归档下载
   /gh/https://github.com/owner/repo/archive/refs/heads/branch.zip
   返回：直接代理下载

Git路由 (/git/) 支持：
1. 仓库克隆
   /git/https://github.com/owner/repo.git

2. Git协议操作
   /git/https://github.com/owner/repo.git/info/refs?service=git-upload-pack

使用示例
-------

示例1：下载仓库主分支
https://your-worker.workers.dev/gh/https://github.com/octocat/Hello-World

示例2：下载特定分支
https://your-worker.workers.dev/gh/https://github.com/octocat/Hello-World/tree/develop

示例3：获取原始文件
https://your-worker.workers.dev/gh/https://github.com/octocat/Hello-World/blob/main/README.md

示例4：Git克隆（通过Git协议）
git clone https://your-worker.workers.dev/git/https://github.com/octocat/Hello-World.git

示例5：GitLab仓库
https://your-worker.workers.dev/git/https://gitlab.com/user/project.git

示例5：下载特定标签
https://your-worker.workers.dev/gh/https://github.com/octocat/Hello-World/releases/tag/v1.0.0

错误处理
-------

常见错误响应：
- 400: URL格式错误或不受支持的协议
- 500: 代理服务器内部错误

特性说明
-------

1. 自动重定向：最多支持10次重定向跟随
2. CORS支持：设置允许跨域访问的头信息
3. 协议支持：仅支持HTTP和HTTPS
4. 头部处理：自动处理Host、User-Agent等必要头部
5. Git协议：支持Git智能协议版本2

注意事项
-------

1. 不再支持直接URL格式，必须使用/gh/或/git/前缀
2. GitHub路由仅支持github.com域名
3. 大文件下载可能会受Worker执行时间限制
4. 建议用于公开仓库，私有仓库需要额外认证处理`
      return new Response(text, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      })
    }
    
    // 不再支持直接 /https://host/path 格式
    return new Response('Invalid URL format. Use /git/https://host/path or /gh/https://github.com/...', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain'}
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// 处理GitHub特定路由
async function handleGitHubRoute(request, pathSegments) {
  if (pathSegments.length < 3) {
    return new Response('Invalid GitHub URL format. Use /gh/https://github.com/owner/repo', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const targetProto = pathSegments[0].replace(/[:]?$/, '')
  const targetHost = pathSegments[1]
  const repoPath = pathSegments.slice(2).join('/')

  // 验证GitHub域名
  if (targetHost !== 'github.com') {
    return new Response('GitHub route only supports github.com', { status: 400 })
  }

  if (!['http', 'https'].includes(targetProto)) {
    return new Response('Only HTTP and HTTPS protocols are supported', { status: 400 })
  }

  const fullPath = `${targetProto}://${targetHost}/${repoPath}`
  let targetUrl

  // 处理不同的GitHub资源类型
  // 处理不同的GitHub资源类型
  if (repoPath.includes('/releases/download/')) {
  // releases下载
  targetUrl = fullPath
  } else if (repoPath.includes('/releases/tag/')) {
  // releases/tag 转换为归档下载
  const tagMatch = repoPath.match(/^([^\/]+\/[^\/]+)\/releases\/tag\/([^\/]+)$/)
  if (tagMatch) {
  const [_, repo, tag] = tagMatch
  targetUrl = `${targetProto}://${targetHost}/${repo}/archive/refs/tags/${tag}.zip`
  } else {
  return new Response('Invalid releases/tag URL format', { status: 400 })
  }
  } else if (repoPath.includes('/archive/')) {
    // 归档下载
    targetUrl = fullPath
  } else if (repoPath.includes('/blob/')) {
    // 原始文件（blob转raw）
    const blobMatch = repoPath.match(/^([^\/]+\/[^\/]+)\/blob\/(.+)$/)
    if (blobMatch) {
      const [_, repo, blobPath] = blobMatch
      targetUrl = `${targetProto}://${targetHost}/${repo}/raw/${blobPath}`
    } else {
      return new Response('Invalid blob URL format', { status: 400 })
    }
  } else if (repoPath.includes('/tree/')) {
    // 分支/标签归档
    const treeMatch = repoPath.match(/^([^\/]+\/[^\/]+)\/tree\/([^\/]+)$/)
    if (treeMatch) {
      const [_, repo, branch] = treeMatch
      targetUrl = `${targetProto}://${targetHost}/${repo}/archive/refs/heads/${branch}.zip`
    } else {
      return new Response('Invalid tree URL format', { status: 400 })
    }
  } else {
    // 默认：主分支归档
    const repoMatch = repoPath.match(/^([^\/]+\/[^\/]+)$/)
    if (repoMatch) {
      const [_, repo] = repoMatch
      targetUrl = `${targetProto}://${targetHost}/${repo}/archive/refs/heads/master.zip`
    } else {
      return new Response('Invalid repository URL format', { status: 400 })
    }
  }

  console.log(`GitHub proxying to: ${targetUrl}`)
  return await proxyRequest(request, targetUrl, targetHost, true)
}

// 处理Git代理路由
async function handleGitRoute(request, pathSegments) {
  if (pathSegments.length < 3) {
    return new Response('Invalid Git repository URL format', { status: 400 })
  }

  const targetProto = pathSegments[0].replace(/[:]?$/, '')
  const targetHost = pathSegments[1]
  const repoPath = pathSegments.slice(2).join('/')

  if (!['http', 'https'].includes(targetProto)) {
    return new Response('Only HTTP and HTTPS protocols are supported', { status: 400 })
  }

  const targetUrl = `${targetProto}://${targetHost}/${repoPath}`
  console.log(`Git proxying to: ${targetUrl}`)
  return await proxyRequest(request, targetUrl, targetHost, false)
}

// 通用代理请求处理，支持自动跟随重定向
async function proxyRequest(request, targetUrl, targetHost = null, followRedirects = true) {
  const maxRedirects = 10 // 最大重定向次数
  let currentUrl = targetUrl
  let redirectCount = 0
  
  // 复制并清理请求头
  const originalHeaders = new Headers()
  for (const [key, value] of request.headers) {
    if (!['host', 'origin', 'referer', 'cookie', 'content-length'].includes(key.toLowerCase())) {
      originalHeaders.set(key, value)
    }
  }
  
  let finalResponse
  
  do {
    const url = new URL(currentUrl)
    const headers = new Headers(originalHeaders)
    
    // 设置必要的头
    if (targetHost) {
      headers.set('Host', targetHost)
    }
    headers.set('User-Agent', 'Git-Proxy-Worker/2.0')
    
    // Git协议特定处理
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
    const proxyRequest = new Request(currentUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: followRedirects ? 'manual' : 'follow'
    })

    console.log(`Proxying to: ${currentUrl}`)
    const response = await fetch(proxyRequest)
    
    // 如果需要跟随重定向且是重定向响应
    if (followRedirects && [301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location')
      if (location) {
        try {
          const redirectUrl = new URL(location, currentUrl)
          currentUrl = redirectUrl.href
          redirectCount++
          
          if (redirectCount > maxRedirects) {
            throw new Error(`Too many redirects (max: ${maxRedirects})`)
          }
          
          console.log(`Following redirect to: ${currentUrl}`)
          continue // 继续处理重定向
        } catch (error) {
          console.error('Redirect URL parsing error:', error)
          finalResponse = response
          break
        }
      }
    }
    
    finalResponse = response
    break
    
  } while (true)

  // 创建代理响应
  const responseHeaders = new Headers(finalResponse.headers)
  
  // 设置CORS头
  responseHeaders.set('Access-Control-Allow-Origin', '*')
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', '*')
  
  // 移除可能引起问题的安全头
  responseHeaders.delete('Content-Security-Policy')
  responseHeaders.delete('X-Frame-Options')
  responseHeaders.delete('X-Content-Type-Options')
  
  // 确保Git协议内容类型正确
  const finalUrl = new URL(currentUrl)
  if (finalUrl.pathname.includes('/info/refs')) {
    const service = finalUrl.searchParams.get('service')
    if (service) {
      responseHeaders.set('Content-Type', `application/x-${service}-advertisement`)
    }
  }

  return new Response(finalResponse.body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders
  })
}

// 测试用例
async function testRoutes() {
  const testCases = [
    // GitHub路由测试
    '/gh/https://github.com/owner/repo',
    '/gh/https://github.com/owner/repo/releases/download/v1.0.0/app.zip',
    '/gh/https://github.com/owner/repo/archive/main.zip',
    '/gh/https://github.com/owner/repo/blob/main/README.md',
    '/gh/https://github.com/owner/repo/tree/develop',
    
    // Git路由测试
    '/git/https://github.com/owner/repo.git',
    '/git/https://gitlab.com/user/project.git',
    '/git/https://github.com/owner/repo/info/refs?service=git-upload-pack',
    
    // 无效路由测试
    '/https://github.com/owner/repo'  // 应该返回错误
  ]
  
  for (const testUrl of testCases) {
    console.log(`Testing URL: ${testUrl}`)
    // 在实际环境中可以添加更详细的测试逻辑
  }
}

export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env, ctx)
  },
}