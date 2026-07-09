<div align="center">
  <a href="https://github.com/Peaceful-World-X/ArXivHub">
    <img src="public/favicon.svg" width="88" height="88" alt="ArXiv Hub · 论桥">
  </a>
  <h1>ArXiv Hub · 论桥</h1>
  <p>输入 arXiv ID，一站跳转阅读、翻译、检索与讨论工具，支持网页和浏览器脚本。</p>
  <p>
    <a href="https://peaceful-world-x.github.io/ArXivHub/">在线使用</a>
    ·
    <a href="https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js">安装脚本</a>
  </p>
  <p>
    <a href="https://github.com/Peaceful-World-X/ArXivHub/stargazers"><img src="https://img.shields.io/github/stars/Peaceful-World-X/ArXivHub?style=flat&amp;color=b31b1b&amp;label=Stars" alt="Stars"></a>
    <a href="https://peaceful-world-x.github.io/ArXivHub/"><img src="https://visitor-badge.laobi.icu/badge?page_id=Peaceful-World-X.ArXivHub&amp;left_color=%236B5B52&amp;right_color=%23D97757" alt="访问数"></a>
    <a href="https://github.com/Peaceful-World-X/ArXivHub/issues"><img src="https://img.shields.io/github/issues/Peaceful-World-X/ArXivHub?style=flat&amp;color=b31b1b&amp;label=Issues" alt="Issues"></a>
  </p>
</div>

## 首页

![ArXiv Hub · 论桥首页](images/cn.png)

[英文首页](images/en.png) · [论文页面](images/paper.png)

## 安装脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [ArXivHub.user.js](https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js)，按提示安装。
3. 刷新 arXiv 论文页即可使用。[查看脚本效果](images/002.png)

## 网址清单

共 82 个入口；分类与[网站配置](web/src/lib/tools.ts)一致。

| 分类 | 名称 | 网址 | 简介 |
| --- | --- | --- | --- |
| 原文 | arXiv 摘要页 | <https://arxiv.org/> | 官方摘要与版本信息 |
| 原文 | arXiv PDF | <https://arxiv.org/> | 官方论文 PDF |
| 原文 | arXiv HTML | <https://arxiv.org/> | 官方 HTML 阅读 |
| 原文 | arXiv 源码包 | <https://arxiv.org/> | 论文 TeX 源码 |
| 原文 | ar5iv HTML | <https://ar5iv.labs.arxiv.org/> | 论文 HTML 阅读 |
| 原文 | ZoteroBib | <https://zbib.org/> | 在线生成参考文献 |
| AIChat | alphaXiv | <https://www.alphaxiv.org/> | 论文阅读与社区注释 |
| AIChat | Cool Papers | <https://papers.cool/> | Kimi 辅助论文阅读 |
| AIChat | ChatPaper | <https://chatpaper.com/> | 每日论文与 AI 对话 |
| AIChat | ArXiv TLDR | <https://arxivtldr.org/> | 论文要点速览 |
| AIChat | arXivisual | <https://arxivisual.org/> | 论文可视化讲解 |
| AIChat | Talk2Arxiv | <https://www.talk2arxiv.org/> | 论文智能问答 |
| AIChat | ScienceCast | <https://www.sciencecast.org/> | 科研论文视频讲解 |
| AIChat | Explainpaper | <https://www.explainpaper.com/> | 论文难句解释 |
| AIChat | SciSpace | <https://scispace.com/> | 论文检索与 AI 阅读 |
| AIChat | ChatDOC | <https://chatdoc.com/> | 带引用的文档问答 |
| AIChat | Papers with Code | <https://paperswithcode.co/> | 论文代码、数据与榜单 |
| Agent | arXiv TXT | <https://www.arxiv-txt.org/> | 论文摘要与纯文本 |
| Agent | arXiv2MD | <https://www.arxiv2md.org/> | 论文转 Markdown |
| Agent | MarkXiv | <https://markxiv.org/> | 论文转纯文本 |
| Agent | arxiv-mcp | <https://github.com/blazickjp/arxiv-mcp-server> | arXiv MCP 检索与阅读 |
| Agent | alphaxiv-mcp | <https://www.alphaxiv.org/docs/mcp> | alphaXiv MCP 接入 |
| Agent | DeepXiv | <https://data.rag.ac.cn/> | 科研检索与数据服务 |
| 翻译 | 幻觉翻译 | <https://hjfy.top/> | 同版式中文译文 |
| 翻译 | ChinArXiv 翻译 | <https://chinarxiv.chatpaper.top/> | 论文中英双语翻译 |
| 翻译 | 沉浸式翻译 | <https://app.immersivetranslate.com/babel-doc/> | 论文与网页翻译 |
| 检索 | ArXiv Xplorer | <https://arxivxplorer.com/> | arXiv 语义搜索 |
| 检索 | arXiv BSHK 语义搜索 | <https://arxiv.bshk.app/> | 浏览器内语义搜索 |
| 检索 | Consensus | <https://consensus.app/> | 基于论文证据的问答 |
| 检索 | Litmaps | <https://app.litmaps.com/preview> | 引文地图与文献发现 |
| 检索 | Semantic Scholar | <https://www.semanticscholar.org/> | 学术检索与引用分析 |
| 检索 | GitHub Search | <https://github.com/search> | 按论文 ID 搜索代码 |
| 检索 | OpenAlex | <https://openalex.org/> | 开放学术目录检索 |
| 检索 | Google Scholar | <https://scholar.google.com/> | 学术搜索与被引信息 |
| 检索 | DBLP | <https://dblp.org/> | 计算机科学文献目录 |
| 讨论 | SciRate | <https://scirate.com/> | 论文评分与讨论 |
| 讨论 | Hugging Face Papers | <https://huggingface.co/papers> | 论文讨论与模型资源 |
| 讨论 | GotIt | <https://gotit.pub/> | 论文阅读与批注讨论 |
| 讨论 | PREreview | <https://prereview.org/> | 预印本开放评审 |
| 讨论 | PubPeer | <https://www.pubpeer.com/> | 论文发表后评议 |
| 讨论 | OpenReview | <https://openreview.net/> | 公开审稿与论文讨论 |
| 讨论 | 小红书搜索 | <https://www.xiaohongshu.com/> | 论文笔记与讨论搜索 |
| 讨论 | X 讨论搜索 | <https://x.com/> | X 论文讨论搜索 |
| 讨论 | Reddit 搜索 | <https://www.reddit.com/> | Reddit 论文讨论搜索 |
| 讨论 | 知乎搜索 | <https://www.zhihu.com/> | 知乎论文解读搜索 |
| 发现 | IArxiv | <https://iarxiv.org/> | 论文发现，需登录 |
| 发现 | ArXiv Daily | <https://www.arxivdaily.com/> | 每日论文与中文摘要 |
| 发现 | PaperDance | <https://paperdance.org/> | 图文速览论文 |
| 发现 | Emergent Mind | <https://www.emergentmind.com/> | AI 摘要与研究追踪 |
| 发现 | Connected Papers | <https://www.connectedpapers.com/> | 相似论文关系图 |
| 发现 | Inciteful | <https://inciteful.xyz/> | 论文引文网络探索 |
| 发现 | Paperscape | <https://paperscape.org/> | arXiv 论文地图 |
| 发现 | PaperMatch | <https://papermatch.me/> | 查找相似论文 |
| 发现 | Scholar Inbox | <https://www.scholar-inbox.com/> | 个性化论文推送 |
| 发现 | arxiv-rss 订阅生成 | <https://ronpay.github.io/arxiv-rss-feed-generator/> | 生成论文 RSS 订阅 |
| \*Xiv | ChinaXiv | <https://chinaxiv.org/> | 中国综合预印本平台 |
| \*Xiv | bioRxiv | <https://www.biorxiv.org/> | 生物学预印本 |
| \*Xiv | medRxiv | <https://www.medrxiv.org/> | 医学与健康科学预印本 |
| \*Xiv | ChemRxiv | <https://chemrxiv.org/> | 化学预印本 |
| \*Xiv | TechRxiv | <https://www.techrxiv.org/> | 电气与计算机技术预印本 |
| \*Xiv | engrXiv | <https://engrxiv.org/> | 工程学预印本 |
| \*Xiv | EarthArXiv | <https://eartharxiv.org/> | 地球科学预印本 |
| \*Xiv | AgriRxiv | <https://www.cabidigitallibrary.org/journal/agrirxiv> | 农业科学预印本 |
| \*Xiv | EcoEvoRxiv | <https://ecoevorxiv.org/> | 生态与进化生物学预印本 |
| \*Xiv | PsyArXiv | <https://osf.io/preprints/psyarxiv> | 心理学预印本 |
| \*Xiv | SocArXiv | <https://osf.io/preprints/socarxiv> | 社会科学工作论文 |
| \*Xiv | SSRN | <https://www.ssrn.com/> | 多学科工作论文 |
| \*Xiv | EconPapers | <https://econpapers.repec.org/> | 经济学文献检索 |
| \*Xiv | Preprints.org | <https://www.preprints.org/> | 综合学科预印本 |
| \*Xiv | ECSarXiv | <https://osf.io/preprints/ecsarxiv/> | 电化学与固态科学预印本 |
| \*Xiv | SportRxiv | <https://sportrxiv.org/> | 运动与体育科学预印本 |
| \*Xiv | EdArXiv | <https://osf.io/preprints/edarxiv> | 教育学预印本 |
| \*Xiv | PhilArchive | <https://philarchive.org/> | 哲学开放论文库 |
| Zotero | arXiv Reader | <https://github.com/TheoCUC/zotero-arxiv-reader> | Zotero 双语 AI 阅读 |
| Zotero | ZotMeta | <https://github.com/RoadToDream/ZotMeta> | 补全与修复元数据 |
| Zotero | arXiv Workflow | <https://github.com/AllanChain/zotero-arxiv-workflow> | 追踪发表与合并版本 |
| Zotero | ZotarXiv | <https://github.com/zhanghm1995/ZotarXiv> | 导入论文与附件 |
| Zotero | HJFY Split Reader | <https://github.com/Infinity4B/zotero-hjfy-split-reader> | 中英 PDF 分屏阅读 |
| Zotero | Convert to arXiv | <https://github.com/EricJin2002/zotero-convert-to-arxiv> | 规范化 arXiv 条目 |
| Zotero | arxiv-marker | <https://github.com/lelelelelelelelelelelelele/arxiv-marker> | 查询正式发表信息 |
| Zotero | AlphaPulse | <https://github.com/IrisM6/AlphaPulse> | 显示论文热度与引用 |
| Zotero | Citation Tally | <https://github.com/daeh/zotero-citation-tally> | 多来源论文引用统计 |

## 本地预览与构建

建议使用 Node.js 22 LTS（22.13+）。

```bash
git clone https://github.com/Peaceful-World-X/ArXivHub.git
cd ArXivHub/web
npm ci
npm run dev
```

开发地址：<http://localhost:8080/>。

```bash
npm run build
npm run preview
```

构建产物为仓库内的 `web/dist/`，预览地址为 <http://localhost:8081/>。端口占用时可运行 `npm run preview -- --port 8082`。

GitHub Pages 工作流在 `web/` 中安装依赖并构建，发布 `web/dist/`。线上地址仍为 <https://peaceful-world-x.github.io/ArXivHub/>，不会增加 `/web/` 前缀。默认卡片顺序保存在 [default-tool-orders.json](web/src/lib/default-tool-orders.json)，本地排序后可保存并随代码发布；已有用户的个人排序优先。

## 项目目录

- `web/`：网页源码、构建配置、依赖清单与测试脚本；npm 命令在此目录执行。
- `public/`：网站图标等静态资源，构建时复制到发布目录，线上资源路径不变。
- `ArXivHub.user.js`：浏览器脚本，保留根目录以兼容已有安装和更新地址。
- `images/`：README 展示图片。
- `screenshots/`：本地验证截图，不提交到 GitHub。

在仓库根目录也可以运行 `npm --prefix web run dev`、`npm --prefix web run build`。

许可证：[MIT](LICENSE)。
