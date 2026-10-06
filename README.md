<div align="center">
  <a href="https://github.com/Peaceful-World-X/ArXivHub">
    <img src="public/favicon.svg" width="88" height="88" alt="ArXiv Hub · 论桥">
  </a>
  <h1>ArXiv Hub · 论桥</h1>
  <p>输入 arXiv ID，一站跳转阅读、翻译、检索与讨论工具，支持网页和浏览器脚本。</p>
  <p>
    <a href="https://arxivhub.github.io/">在线使用</a>
    ·
    <a href="https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js">安装脚本</a>
  </p>
  <p>
    <a href="https://github.com/Peaceful-World-X/ArXivHub/stargazers"><img src="https://img.shields.io/github/stars/Peaceful-World-X/ArXivHub?style=flat&amp;color=b31b1b&amp;label=Stars" alt="Stars"></a>
    <a href="https://arxivhub.github.io/"><img src="https://visitor-badge.laobi.icu/badge?page_id=Peaceful-World-X.ArXivHub&amp;left_color=%236B5B52&amp;right_color=%23D97757" alt="访问数"></a>
    <a href="https://github.com/Peaceful-World-X/ArXivHub/issues"><img src="https://img.shields.io/github/issues/Peaceful-World-X/ArXivHub?style=flat&amp;color=b31b1b&amp;label=Issues" alt="Issues"></a>
    <a href="https://linux.do"><img src="https://shorturl.at/ggSqS" alt="LINUX DO"></a>
  </p>
</div>

## 首页

![ArXiv Hub · 论桥首页](images/cn.png)

[英文首页](images/en.png) · [论文页面](images/paper.png)

## 安装脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [ArXivHub.user.js](https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js)，按提示安装。
3. 刷新 arXiv 论文页即可使用。[查看脚本效果](images/002.png)

脚本同步论文页入口、引用数和点赞数。点击圆形「＋」可添加或管理自定义网站，网址支持 `{id}`、`{title}`、`{url}`、`{doi}`，设置保存在浏览器中。

## 网址清单

共 116 个入口（98 个网址、18 个工具、12 个类别）；分类与[网站配置](web/src/lib/tools.ts)一致。

收录原则：不收录仅付费才能使用的网站。

| 分类 | 名称 | 网址 | 简介 |
| --- | --- | --- | --- |
| 原文 | arXiv 摘要页 | <https://arxiv.org/> | 官方页面看摘要、版本、作者与 DOI。 |
| 原文 | arXiv PDF | <https://arxiv.org/> | 最稳定的原版 PDF 入口。 |
| 原文 | arXiv HTML | <https://arxiv.org/> | 官方网页正文，可搜索、复制和看公式。 |
| 原文 | arXiv 源码包 | <https://arxiv.org/> | 下载 TeX、Bib 和图片源文件。 |
| 原文 | ar5iv HTML | <https://ar5iv.labs.arxiv.org/> | 把 TeX 变成更适合网页阅读的 HTML。 |
| 原文 | arXiv TB | <https://arxiv.org/tb/> | 查看论文在站外留下的 Trackbacks。 |
| AI解读 | Cool Papers | <https://papers.cool/> | 按 arXiv 分类刷新论文，Kimi 入口就在旁边。 |
| AI解读 | ArXiv TLDR | <https://arxivtldr.org/> | 一页压缩 TLDR、关键要点和 Why it matters。 |
| AI解读 | arXivisual | <https://arxivisual.org/> | 把方法流程做成视频，复杂结构一眼看懂。 |
| AI解读 | Gist Science | <https://gist.science/> | 通俗解释、核心结论和技术摘要一次给齐。 |
| AI解读 | Moonlight | <https://www.themoonlight.io/zh> | 像读 Review 一样看方法、贡献、实验和意义。 |
| AI解读 | Growbotics | <https://robotics.growbotics.ai/research/papers> | 机器人和具身智能论文的重点与项目资源。 |
| AI解读 | DeepPaper | <https://arxiv.deeppaper.ai/> | 按领域和主题整理论文，不用在 arXiv 里迷路。 |
| AI解读 | AIModels.fyi | <https://www.aimodels.fyi/> | 用问题式摘要连接 AI 论文与模型生态。 |
| AI解读 | ScienceCast | <https://www.sciencecast.org/> | 论文的演讲版：视频和交互媒体一起讲。 |
| AI解读 | Paperlayer | <https://paperlayer.ai/> | AI 总结能回指原文证据，少一点黑箱感。 |
| AI解读 | ScienceStack | <https://www.sciencestack.ai/> | 把摘要、章节、公式和图表拆成可读结构。 |
| AI解读 | SummarizePaper | <https://www.summarizepaper.com/> | 按 ID 生成关键点和通俗摘要，先扫一眼再决定。 |
| AI解读 | arXivMax | <https://www.arxivmax.com/> | 把论文变成 Explainer 和视频，快速抓住全貌。 |
| AI解读 | ArxivLens | <https://arxivlens.com/> | 跨论文库给出 Quick Summary、Key Findings 和引用。 |
| AI问答 | alphaXiv | <https://www.alphaxiv.org/> | 边读论文边提问，旁边还有社区注释。 |
| AI问答 | ChatPaper | <https://chatpaper.com/> | 围绕论文正文对话，顺便刷每日论文。 |
| AI问答 | Talk2Arxiv | <https://www.talk2arxiv.org/> | 改个链接就能和这篇 arXiv 论文对话。 |
| AI问答 | asXiv | <https://asxiv.org/> | 右侧直接追问当前论文，轻量但很顺手。 |
| AI问答 | Explainpaper | <https://www.explainpaper.com/> | 选中难句，让 AI 专门解释这一个地方。 |
| AI问答 | SciSpace | <https://scispace.com/> | 科研 PDF Copilot，划词解释并继续追问。 |
| AI问答 | ChatDOC | <https://chatdoc.com/> | 回答带原文引用，问完还能回到证据。 |
| 检索 | ArXiv Xplorer | <https://arxivxplorer.com/> | 用自然语言、ID 或 URL 做 arXiv 语义搜索。 |
| 检索 | arXiv BSHK 语义搜索 | <https://arxiv.bshk.app/> | 轻量语义搜索，关键词不够时来这里。 |
| 检索 | Hugging Face Papers | <https://huggingface.co/papers> | 把论文、模型、数据集、Demo 和社区串起来。 |
| 检索 | OpenTrain AI | <https://www.opentrain.ai/papers/> | 按 ID 找实现，并查看维护、CI 和许可证信号。 |
| 检索 | searchthearXiv | <https://searchthearxiv.com/> | 围绕一篇论文继续找相近研究。 |
| 检索 | CatalyzeX | <https://www.catalyzex.com/> | 论文到代码，专门找 Paper → Code。 |
| 检索 | Consensus | <https://consensus.app/> | 把研究问题交给多篇论文一起回答。 |
| 检索 | Litmaps | <https://app.litmaps.com/preview> | 从一篇种子论文画出前后继引用地图。 |
| 检索 | Connected Papers | <https://www.connectedpapers.com/> | 看共引关系图，不只是普通引用列表。 |
| 检索 | Inciteful | <https://inciteful.xyz/> | 展开前向和后向引用，找关键桥接文献。 |
| 检索 | Paperscape | <https://paperscape.org/> | 把整个 arXiv 画成一张可以缩放的地图。 |
| 检索 | PaperMatch | <https://papermatch.me/> | 丢进一篇论文，快速找内容相近的工作。 |
| 检索 | Semantic Scholar | <https://www.semanticscholar.org/> | 搜索、TLDR、引用网络和相关论文一站完成。 |
| 检索 | GitHub Search | <https://github.com/search> | 拿 arXiv ID 反查真正的代码仓库。 |
| 检索 | OpenAlex | <https://openalex.org/> | 开放知识图谱，追作者、机构、主题和引用。 |
| 检索 | Google Scholar | <https://scholar.google.com/> | 查被引、不同版本和正式发表版，覆盖面很大。 |
| 检索 | Papers with Code | <https://paperswithcode.co/> | 论文、代码、数据集和 SOTA 榜单连在一起。 |
| 检索 | DBLP | <https://dblp.org/> | 确认计算机论文的会议、期刊和作者记录。 |
| 检索 | EconPapers | <https://econpapers.repec.org/> | RePEc 经济学检索，工作论文尤其好用。 |
| 讨论 | SciRate | <https://scirate.com/> | 看研究者投票和评论，筛掉信息噪声。 |
| 讨论 | Pith | <https://pith.science/> | 公开机器审稿，直接指出主要问题和可疑论证。 |
| 讨论 | GotIt | <https://gotit.pub/> | 围绕正文做批注，讨论就贴在原文旁边。 |
| 讨论 | PREreview | <https://prereview.org/> | 给预印本做开放同行评审。 |
| 讨论 | PubPeer | <https://www.pubpeer.com/> | 看发表后质疑、勘误和作者回应。 |
| 讨论 | OpenReview | <https://openreview.net/> | 直接看 Review、Rebuttal 和评分。 |
| 讨论 | 小红书搜索 | <https://www.xiaohongshu.com/> | 搜中文论文笔记、图解和复现经验。 |
| 讨论 | X 讨论搜索 | <https://x.com/> | 追作者发布和研究者即时讨论串。 |
| 讨论 | Reddit 搜索 | <https://www.reddit.com/> | 找 AI 社区里更长、更敢说的讨论。 |
| 讨论 | 知乎搜索 | <https://www.zhihu.com/> | 搜索中文长文解读和技术背景。 |
| 翻译 | 幻觉翻译 | <https://hjfy.top/> | 生成接近原排版的中文 PDF。 |
| 翻译 | ChinArXiv 翻译 | <https://chinarxiv.chatpaper.top/> | 打开中英双语版本，适合对照读。 |
| 翻译 | 沉浸式翻译 | <https://app.immersivetranslate.com/babel-doc/> | 网页和 PDF 一起翻，科研网页也能用。 |
| 翻译 | PDF2zh | <https://pdf2zh.com/> | 重点保留 PDF 的布局、公式和图表。 |
| 发现 | IArxiv | <https://iarxiv.org/> | 按个人兴趣发现 arXiv，登录后更懂你。 |
| 发现 | ArXiv Daily | <https://www.arxivdaily.com/> | 每天整理新论文，还给中文摘要。 |
| 发现 | PaperDance | <https://paperdance.org/> | 把新论文做成图文卡片，刷起来不累。 |
| 发现 | Emergent Mind | <https://www.emergentmind.com/> | 追热门 AI 论文、主题页和研究趋势。 |
| 发现 | AI Papers | <https://aipapers.ai/> | 每日精选 AI 论文，顺手做语义问答。 |
| 发现 | Scholar Feed | <https://www.scholarfeed.org/> | 按相关性、新颖性和影响力筛论文。 |
| 发现 | Astro arXiv Sanity | <https://astro-arxiv-sanity.com/> | 天体物理专用的论文筛选器。 |
| 发现 | ArXivTok | <https://arxivtok.vercel.app/> | TikTok 式刷 arXiv，低成本快速筛选。 |
| 发现 | Benty Fields | <https://www.benty-fields.com/seminars> | 论文发现、Journal Club 和 Seminar 放一处。 |
| 发现 | PaperSwipe | <https://paperswipe.co/> | 像刷卡片一样筛论文，喜欢再留下。 |
| 发现 | SOTA Papers | <https://www.sotapapers.com/> | 编辑精选论文，用短文讲清贡献和强弱。 |
| 发现 | WeekInPapers | <https://weekinpapers.com/> | 每周 CS arXiv 论文配通俗摘要和应用方向。 |
| 发现 | The Latest in AI | <https://thelatestinai.com/> | 把最新 AI 论文聚成主题，看研究风向。 |
| 订阅 | arXivSub | <https://arxivsub.comfyai.app/> | 按作者、机构和关键词订阅新论文。 |
| 订阅 | Paper Digest | <https://www.paperdigest.org/arxiv/> | 按领域和作者追踪每日论文 Highlight。 |
| 订阅 | ggrxiv | <https://www.ggrxiv.com/> | 按研究兴趣发现每日预印本。 |
| 订阅 | LitDigest | <https://litdigest.app/> | 用一句研究方向换来每周匹配论文。 |
| 订阅 | inveni | <https://inveni.uk/> | 从你的文献库学兴趣，每天推新论文。 |
| 订阅 | Uncited | <https://uncited.org/> | 跨 arXiv、bioRxiv 和期刊追新文章。 |
| 订阅 | Scholar Inbox | <https://www.scholar-inbox.com/> | 用点赞/踩训练你的论文推荐收件箱。 |
| 订阅 | arxiv-rss 订阅生成 | <https://ronpay.github.io/arxiv-rss-feed-generator/> | 自己拼条件，生成专属 arXiv RSS。 |
| Xiv宇宙 | ChinaXiv | <https://chinaxiv.org/> | 中科院体系的综合预印本平台。 |
| Xiv宇宙 | bioRxiv | <https://www.biorxiv.org/> | 生命科学预印本的核心入口。 |
| Xiv宇宙 | medRxiv | <https://www.medrxiv.org/> | 医学、临床和公共卫生预印本入口。 |
| Xiv宇宙 | ChemRxiv | <https://chemrxiv.org/> | 化学领域的主流预印本平台。 |
| Xiv宇宙 | TechRxiv | <https://www.techrxiv.org/> | 电气、电子和计算机技术预印本。 |
| Xiv宇宙 | engrXiv | <https://engrxiv.org/> | 工程学科的开放预印本库。 |
| Xiv宇宙 | EarthArXiv | <https://eartharxiv.org/> | 地球、环境和行星科学预印本。 |
| Xiv宇宙 | AgriRxiv | <https://www.cabidigitallibrary.org/journal/agrirxiv> | 农业、食品和应用科学预印本。 |
| Xiv宇宙 | EcoEvoRxiv | <https://ecoevorxiv.org/> | 生态、进化与保育生物学预印本。 |
| Xiv宇宙 | PsyArXiv | <https://osf.io/preprints/psyarxiv> | 心理学与行为科学开放预印本。 |
| Xiv宇宙 | SocArXiv | <https://osf.io/preprints/socarxiv> | 社会学与社会科学工作论文。 |
| Xiv宇宙 | SSRN | <https://www.ssrn.com/> | 法律、经济、金融和社会科学工作论文。 |
| Xiv宇宙 | Preprints.org | <https://www.preprints.org/> | 覆盖多学科的综合预印本平台。 |
| Xiv宇宙 | ECSarXiv | <https://osf.io/preprints/ecsarxiv/> | 电化学与固态科学预印本。 |
| Xiv宇宙 | SportRxiv | <https://sportrxiv.org/> | 运动科学与人体表现研究预印本。 |
| Xiv宇宙 | EdArXiv | <https://osf.io/preprints/edarxiv> | 教育学与教育研究预印本。 |
| Xiv宇宙 | PhilArchive | <https://philarchive.org/> | 哲学专业开放论文库。 |
| Agent | arXiv TXT | <https://www.arxiv-txt.org/> | 把论文变成 LLM 能直接吃的纯文本。 |
| Agent | arXiv2MD | <https://www.arxiv2md.org/> | 把 HTML 清成适合 LLM 的 Markdown。 |
| Agent | ArcXiv | <https://arcxiv.org/> | 搜索 API、结构化 Markdown 和 MCP 一起接入。 |
| Agent | MarkXiv | <https://markxiv.org/> | 从 LaTeX 结构生成 Markdown。 |
| Agent | arxiv-mcp | <https://github.com/blazickjp/arxiv-mcp-server> | 给 MCP 客户端搜索、下载和分章节读 arXiv。 |
| Agent | arxiv.py | <https://github.com/lukasschwab/arxiv.py> | Python 分页搜索和下载论文。 |
| Agent | Scry | <https://scry.io/> | 把 arXiv、Reddit、HN 接进 Agent。 |
| Agent | alphaxiv-mcp | <https://www.alphaxiv.org/docs/mcp> | 让 Agent 调用 alphaXiv 的全文和报告。 |
| Agent | DeepXiv | <https://data.rag.ac.cn/> | 给 Agent 用的科研全文数据层。 |
| Zotero | ZotMeta | <https://github.com/RoadToDream/ZotMeta> | 用 DOI、ISBN、arXiv ID 修元数据。 |
| Zotero | arXiv Workflow | <https://github.com/AllanChain/zotero-arxiv-workflow> | 追踪正式发表，并合并预印本版本。 |
| Zotero | HJFY Split Reader | <https://github.com/Infinity4B/zotero-hjfy-split-reader> | 在 Zotero 里并排看原文和译文。 |
| Zotero | arxiv-marker | <https://github.com/lelelelelelelelelelelelele/arxiv-marker> | 给 arXiv 条目补会议、CCF/CORE 和引用。 |
| Zotero | Citation Tally | <https://github.com/daeh/zotero-citation-tally> | 在 Zotero 列表里直接看多源引用量。 |
| Zotero | Zotero-arXiv-Daily | <https://github.com/TideDra/zotero-arxiv-daily> | 用你的 Zotero 文库每天推荐新 arXiv。 |
| Tool | ar5iv Editor | <https://latexml.rs/editor> | 浏览器里编辑 LaTeX，实时看 HTML/MathML。 |
| Tool | ZoteroBib | <https://zbib.org/> | 不用装 Zotero，输入 DOI/URL 就出 BibTeX。 |
| Tool | EasyRead | <https://github.com/Edwardxlai/easyread> | 本地双语阅读器，公式、批注和模型都能接。 |

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
构建时会同步生成油猴脚本的导航、图标与统计逻辑。也可单独运行 `npm run sync:userscript`，或使用 `npm run sync:userscript -- --check` 检查是否同步。

GitHub Pages 工作流在 `web/` 中安装依赖并构建，发布 `web/dist/`。新站点地址为 <https://arxivhub.github.io/>，论文链接例如 <https://arxivhub.github.io/p/1706.03762>。`sync-arxivhub-pages.yml` 使用根路径 `/` 构建并同步到 `ArXivHub/ArXivHub.github.io`，需配置 `ARXIVHUB_DEPLOY_TOKEN`；`deploy-pages.yml` 保留源仓库的子路径部署。默认卡片顺序保存在 [default-tool-orders.json](web/src/lib/default-tool-orders.json)，本地排序后可保存并随代码发布；已有用户的个人排序优先。

## 项目目录

- `web/`：网页源码、构建配置、依赖清单与测试脚本；npm 命令在此目录执行。
- `public/`：网站图标等静态资源，构建时复制到发布目录，线上资源路径不变。
- `ArXivHub.user.js`：浏览器脚本，保留根目录以兼容已有安装和更新地址。
- `images/`：README 展示图片。
- `screenshots/`：本地验证截图，不提交到 GitHub。

在仓库根目录也可以运行 `npm --prefix web run dev`、`npm --prefix web run build`。

许可证：[MIT](LICENSE)。
