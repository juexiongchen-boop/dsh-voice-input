# dsh-voice-input

DeepSeek Harness 输入框语音输入插件 —— 单包双面，一行注册。

在 Web GUI 的输入框工具行加入 🎤 按钮：浏览器采集麦克风，经 WebSocket 推送到本地
sherpa-onnx 流式识别 sidecar，边说话边出字，断句后自动追加进输入框草稿。

## 功能

- 🎤 麦克风按钮（颜色与发送按钮同款主题蓝，录音中切换红色暂停符脉冲）
- 输入框上方实时字幕胶囊（#679EFE 半透明 + 白色暂停符图标）
- 断句自动追加进草稿：连续追加、不覆盖、不复活已删内容
- 静音 3 秒且无待提交文字时自动停止录音（权威检测在 sidecar，空断句免疫）
- 全本地离线识别：中英双语流式 + 自动标点，CPU 实时（实测 RTF ≈ 0.12）

## 语音识别方案

| 层 | 选型 |
| --- | --- |
| 推理框架 | [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)（ONNX Runtime，Apache-2.0） |
| Node 绑定 | `sherpa-onnx-node`（流式 `OnlineRecognizer`） |
| 主模型 | `sherpa-onnx-x-asr-480ms-streaming-zipformer-transducer-zh-en-punct-int8-2026-06-05` —— X-ASR 流式 Zipformer-Transducer，**中英双语 + 自动标点**，480ms 延迟块，int8 量化约 128MB |
| 备用模型 | `sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30`（纯中文流式） |
| 音频规格 | 16kHz 单声道 16-bit PCM（浏览器 `getUserMedia` 采集，AudioContext 重采样） |
| 断句 | sherpa-onnx 内置端点检测（1.2s / 2.4s 静音双规则） |
| 实测性能 | CPU 单线程 **RTF ≈ 0.12**（8 倍实时），**首字延迟 ≈ 69ms** |

**为什么不是 Whisper / FunASR / transformers.js**：

- 中文准确率：FunASR 官方基准（184 段中文长音频）中 Whisper-large-v3 字错率
  20%，Paraformer/SenseVoice 系 8–10%——差 2 倍以上；
- FunASR 中文效果强，但需要 Python sidecar，GPU 才能发挥优势；
- transformers.js 纯浏览器零后端，但**非流式**（"说完→出字"）且占页面内存；
- sherpa-onnx 是唯一同时满足 **Node 原生 + 真流式（边说话边出字）+ 中文强 +
  全离线 CPU 实时 + Apache-2.0 + 维护极活跃** 的选项，与 DSH 的 Node 宿主天然同构。

## 架构

```
浏览器（本包 ./client 半，dsh.client roster 行）
  │ getUserMedia 16kHz 单声道 PCM → ws://127.0.0.1:6035
  ▼
宿主插件（本包主入口，subprocess 服务 spawn + 生命周期托管）
  ▼
%DSH_HOME%/voice-asr/server.js ← sherpa-onnx-node 流式识别（X-ASR 中英双语 int8）
  └ models/（模型文件约 256MB，不入库，由 fetch-models.ps1 下载）
```

## 安装（三步）

### 1. 部署 sidecar 运行时与模型

```powershell
# 克隆本仓库后，在仓库根目录执行：
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

或手动：把 `runtime/` 内容复制到 `%DSH_HOME%/voice-asr/`，
`npm install` 后运行 `fetch-models.ps1`（从 k2-fsa/sherpa-onnx GitHub Releases
下载两个 int8 模型，约 256MB）。

### 2. 安装插件包到 web profile

```bash
dsh plugin --profile web add github:juexiongchen-boop/dsh-voice-input
```

> 包名 `dsh-voice-input` 经 profile 目录的 Node 父级解析，peer 依赖
> （cordis / ui-slots / react 等）由 dsh 安装后备目录自动满足，无需 npm 发布。

### 3. 注册组合行并重启

在 `%DSH_HOME%/profiles/web/cordis.patch.yml` 的 `insert` 列表中加入：

```yaml
    - id: voice-input
      name: 'dsh-voice-input'
```

重启 `dsh web`。启动后宿主插件自动拉起 sidecar
（日志：`%DSH_HOME%/voice-asr/host-plugin.log`），页面输入框出现 🎤，无需任何批准。

## 常见问题

- **点击 🎤 提示"无法连接语音服务"**：检查 `host-plugin.log`（apply/spawn 链路）与
  `http://127.0.0.1:6035/health`（应返回 ok）。端口被占用时先释放 6035。
- **识别不理想**：环境噪声大时可换用 VAD 门控（后续版本）；模型可替换为
  `runtime/server.js --model-dir` 指定的任意 sherpa-onnx 流式模型。
- **浏览器要求**：Chromium / Firefox，需授予麦克风权限；页面必须经
  localhost（或安全上下文）访问。

## 开发说明

- 包为**单包双面**：`main`（lib/index.js）是宿主半（sidecar 管理），
  `exports["./client"]`（lib/client.js）是浏览器半，`dsh.client` 元数据声明 roster 注入。
  仿 dsh-canvas 的一行注册模式。
- 仓库随附**预构建产物**（lib/），开箱即用；修改源码后如需重建，把 `src/` 放回
  deepseek-harness 工作区的对应包目录（`packages/host/voice-input`、
  `packages/client/ui-voice-input`），用仓库的 tsdown 预设重建再拷回。

## 许可

MIT。识别模型来自 [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
（Apache-2.0），模型权重以各自模型卡为准。
