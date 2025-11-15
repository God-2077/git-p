GitHub & Git 代理 Worker API 使用教程
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
4. 建议用于公开仓库，私有仓库需要额外认证处理