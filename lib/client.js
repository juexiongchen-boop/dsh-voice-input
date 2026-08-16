window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-voice-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region \0dsh-css:F:\DeepseekHarness\deepseek-harness\packages\client\ui-voice-input\src\client\voice.module.css.mjs
		const css = ".FwEQhG_micBtn{cursor:pointer;background:0 0;border:1px solid #0000;border-radius:7px;justify-content:center;align-items:center;width:26px;height:26px;padding:0;display:inline-flex}.FwEQhG_micSvg{fill:var(--dsw-alias-button-info-fill);opacity:.85;transition:fill .1s,opacity .1s}.FwEQhG_micBtn:hover .FwEQhG_micSvg{fill:var(--dsw-alias-button-info-hover);opacity:1}.FwEQhG_micBtn[data-state=starting] .FwEQhG_micSvg{fill:#e6a23c;opacity:1;animation:1.1s ease-in-out infinite FwEQhG_voicePulse}.FwEQhG_micBtn[data-state=listening] .FwEQhG_micSvg,.FwEQhG_micBtn[data-state=listening] .FwEQhG_pendingSvg{fill:#f56c6c;opacity:1;animation:1.1s ease-in-out infinite FwEQhG_voicePulse}.FwEQhG_micBtn[data-state=error] .FwEQhG_micSvg{fill:#f56c6c;opacity:1}@keyframes FwEQhG_voicePulse{0%,to{opacity:1}50%{opacity:.4}}.FwEQhG_livePill{color:#fff;pointer-events:none;white-space:pre-wrap;z-index:20;background:#679efecc;border:1.5px solid #3964fe8c;border-radius:12px;max-width:70vw;padding:8px 14px;font-size:12.5px;line-height:1.55;position:absolute;bottom:10px;left:50%;transform:translate(-50%);box-shadow:0 6px 18px #3964fe66}.FwEQhG_livePill .FwEQhG_pendingSvg{fill:#fff;vertical-align:middle;margin-right:7px;animation:1.1s ease-in-out infinite FwEQhG_voicePulse}";
		const tagId = "@deepseek-ai/dsh-client-ui-voice-input/voice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-voice-input";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var voice_module_css_default = {
			"micSvg": "FwEQhG_micSvg",
			"micBtn": "FwEQhG_micBtn",
			"voicePulse": "FwEQhG_voicePulse",
			"livePill": "FwEQhG_livePill",
			"pendingSvg": "FwEQhG_pendingSvg"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "ui-voice-input";
		const inject = ["slots"];
		const SIDECAR_URL = "ws://127.0.0.1:6035";
		const SILENCE_MS = 3e3;
		function audioContextCtor() {
			if (typeof window === "undefined") return void 0;
			return window.AudioContext ?? window.webkitAudioContext;
		}
		const MIC_PATH = "M512 683.52c130.56 0 235.52-102.4 235.52-232.96V256c0-130.56-104.96-232.96-235.52-232.96s-235.52 102.4-235.52 232.96v194.56c0 130.56 102.4 232.96 235.52 232.96z m368.64-281.6c0-23.04-20.48-43.52-46.08-43.52s-43.52 20.48-43.52 43.52c0 5.12 0 10.24 2.56 12.8v33.28c0 151.04-125.44 276.48-281.6 276.48-153.6 0-281.6-125.44-281.6-276.48V409.6c0-2.56 2.56-5.12 2.56-10.24 0-23.04-20.48-43.52-43.52-43.52-25.6 0-43.52 20.48-43.52 43.52v64c0 186.88 140.8 335.36 320 360.96v87.04h-122.88c-25.6 0-46.08 20.48-46.08 46.08s20.48 43.52 46.08 43.52h332.8c28.16 0 43.52-17.92 43.52-43.52 0-23.04-17.92-46.08-43.52-46.08h-122.88v-87.04c184.32-20.48 327.68-174.08 327.68-360.96v-61.44z m0 0";
		const PENDING_PATH = "M554.666667 128v768c0 23.466667-19.2 42.666667-42.666667 42.666667s-42.666667-19.2-42.666667-42.666667V128c0-23.466667 19.2-42.666667 42.666667-42.666667s42.666667 19.2 42.666667 42.666667z m149.333333 128c-23.466667 0-42.666667 19.2-42.666667 42.666667v426.666666c0 23.466667 19.2 42.666667 42.666667 42.666667s42.666667-19.2 42.666667-42.666667V298.666667c0-23.466667-19.2-42.666667-42.666667-42.666667z m-384 0c-23.466667 0-42.666667 19.2-42.666667 42.666667v426.666666c0 23.466667 19.2 42.666667 42.666667 42.666667s42.666667-19.2 42.666667-42.666667V298.666667c0-23.466667-19.2-42.666667-42.666667-42.666667z m-192 106.666667c-23.466667 0-42.666667 19.2-42.666667 42.666666v213.333334c0 23.466667 19.2 42.666667 42.666667 42.666666s42.666667-19.2 42.666667-42.666666V405.333333c0-23.466667-19.2-42.666667-42.666667-42.666666z m768 0c-23.466667 0-42.666667 19.2-42.666667 42.666666v213.333334c0 23.466667 19.2 42.666667 42.666667 42.666666s42.666667-19.2 42.666667-42.666666V405.333333c0-23.466667-19.2-42.666667-42.666667-42.666666z";
		function apply(ctx) {
			const timer = ctx.get("timer");
			let store = {
				state: "idle",
				partial: "",
				error: null
			};
			const subs = /* @__PURE__ */ new Set();
			function patch(p) {
				store = {
					...store,
					...p
				};
				for (const fn of subs) try {
					fn();
				} catch {}
			}
			function subscribe(fn) {
				subs.add(fn);
				return () => {
					subs.delete(fn);
				};
			}
			let session = null;
			let autoStop = null;
			function clearAutoStop() {
				if (autoStop !== null) {
					try {
						autoStop();
					} catch {}
					autoStop = null;
				}
			}
			function scheduleAutoStop() {
				clearAutoStop();
				if (timer === void 0) return;
				autoStop = timer.timeout(() => {
					autoStop = null;
					if (session !== null && store.partial === "") stopListening();
				}, SILENCE_MS);
			}
			const latest = {
				inputActions: void 0,
				draft: "",
				sessionId: null
			};
			function stopListening() {
				clearAutoStop();
				const s = session;
				session = null;
				if (s === null) return;
				try {
					s.track?.stop();
				} catch {}
				try {
					s.ws.close();
				} catch {}
				try {
					s.audioCtx.close();
				} catch {}
				patch({
					state: "idle",
					partial: ""
				});
			}
			function appendToDraft(text) {
				const ia = latest.inputActions;
				if (ia?.setDraft === void 0) {
					patch({
						state: "error",
						error: "无法写入输入框：inputActions.setDraft 不可用"
					});
					return;
				}
				const base = latest.draft;
				const next = base === "" ? text : `${base} ${text}`;
				latest.draft = next;
				try {
					ia.setDraft(next);
				} catch (error) {
					patch({
						state: "error",
						error: `写入输入框失败：${String(error)}`
					});
				}
			}
			async function startListening() {
				if (session !== null) {
					stopListening();
					return;
				}
				if (typeof navigator === "undefined" || navigator.mediaDevices === void 0 || typeof navigator.mediaDevices.getUserMedia !== "function") {
					patch({
						state: "error",
						error: "浏览器不支持 getUserMedia（需要 Chromium/Firefox 且允许麦克风权限）"
					});
					return;
				}
				if (typeof WebSocket === "undefined") {
					patch({
						state: "error",
						error: "浏览器不支持 WebSocket"
					});
					return;
				}
				const AC = audioContextCtor();
				if (AC === void 0) {
					patch({
						state: "error",
						error: "浏览器不支持 AudioContext"
					});
					return;
				}
				patch({
					state: "starting",
					error: null,
					partial: ""
				});
				let ws = null;
				let audioCtx = null;
				let track = null;
				try {
					ws = new WebSocket(SIDECAR_URL);
					await new Promise((resolve, reject) => {
						ws.onopen = () => {
							resolve();
						};
						ws.onerror = () => {
							reject(/* @__PURE__ */ new Error(`无法连接语音服务 ${SIDECAR_URL}（sidecar 未启动？）`));
						};
					});
					ws.onmessage = (ev) => {
						let msg = {};
						try {
							msg = JSON.parse(String(ev.data));
						} catch {
							return;
						}
						if (msg.type === "partial") {
							patch({ partial: msg.text ?? "" });
							if (msg.text !== void 0 && msg.text !== "") scheduleAutoStop();
						} else if (msg.type === "endpoint") {
							if (msg.text !== void 0 && msg.text !== "") {
								appendToDraft(msg.text);
								scheduleAutoStop();
							}
							patch({ partial: "" });
						} else if (msg.type === "silence-timeout") stopListening();
					};
					ws.onclose = () => {
						if (session !== null && session.ws === ws) {
							session = null;
							clearAutoStop();
							patch({
								state: "idle",
								partial: ""
							});
						}
					};
					ws.send(JSON.stringify({ type: "reset" }));
					const stream = await navigator.mediaDevices.getUserMedia({ audio: {
						channelCount: 1,
						sampleRate: 16e3,
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					} });
					track = stream.getTracks()[0] ?? null;
					audioCtx = new AC({ sampleRate: 16e3 });
					await audioCtx.resume();
					const source = audioCtx.createMediaStreamSource(stream);
					const gain = audioCtx.createGain();
					gain.gain.value = 0;
					const proc = audioCtx.createScriptProcessor(2048, 1, 1);
					proc.onaudioprocess = (e) => {
						if (session === null || session.ws !== ws || ws?.readyState !== 1) return;
						const ch = e.inputBuffer.getChannelData(0);
						const buf = /* @__PURE__ */ new ArrayBuffer(ch.length * 2);
						const dv = new DataView(buf);
						for (let i = 0; i < ch.length; i++) {
							let v = ch[i] ?? 0;
							if (v > 1) v = 1;
							if (v < -1) v = -1;
							dv.setInt16(i * 2, v < 0 ? v * 32768 : v * 32767, true);
						}
						ws?.send(buf);
					};
					source.connect(proc);
					proc.connect(gain);
					gain.connect(audioCtx.destination);
					session = {
						ws,
						audioCtx,
						track
					};
					patch({ state: "listening" });
					scheduleAutoStop();
				} catch (error) {
					try {
						ws?.close();
					} catch {}
					try {
						track?.stop();
					} catch {}
					try {
						audioCtx?.close();
					} catch {}
					session = null;
					clearAutoStop();
					patch({
						state: "error",
						error: String(error)
					});
				}
			}
			function MicIcon() {
				return (0, react.createElement)("svg", {
					className: voice_module_css_default.micSvg,
					viewBox: "0 0 1024 1024",
					width: 16,
					height: 16,
					"aria-hidden": true
				}, (0, react.createElement)("path", { d: MIC_PATH }));
			}
			function PendingIcon() {
				return (0, react.createElement)("svg", {
					className: voice_module_css_default.pendingSvg,
					viewBox: "0 0 1024 1024",
					width: 12,
					height: 12,
					"aria-hidden": true
				}, (0, react.createElement)("path", { d: PENDING_PATH }));
			}
			function MicButton(props) {
				const [st, setSt] = (0, react.useState)(store);
				(0, react.useEffect)(() => subscribe(() => {
					setSt(store);
				}), []);
				const seat = props ?? {};
				if (seat.inputActions !== void 0) latest.inputActions = seat.inputActions;
				if (typeof seat.sessionId === "string") latest.sessionId = seat.sessionId;
				let d = null;
				if (typeof seat.useInput === "function") try {
					const input = seat.useInput();
					if (input !== void 0 && typeof input.draft === "string") d = input.draft;
				} catch {}
				if (d === null && seat.input !== void 0 && typeof seat.input.draft === "string") d = seat.input.draft;
				if (d !== null) latest.draft = d;
				const label = st.state === "error" ? st.error ?? "语音输入错误" : st.state === "listening" ? "停止语音输入" : "语音输入（sherpa-onnx 本地识别）";
				return (0, react.createElement)("button", {
					type: "button",
					className: voice_module_css_default.micBtn,
					"data-state": st.state,
					title: label,
					"aria-label": label,
					onClick: () => {
						startListening();
					}
				}, st.state === "listening" ? (0, react.createElement)(PendingIcon) : (0, react.createElement)(MicIcon));
			}
			function LiveOverlay() {
				const [st, setSt] = (0, react.useState)(store);
				(0, react.useEffect)(() => subscribe(() => {
					setSt(store);
				}), []);
				if (st.state !== "listening" && st.state !== "starting") return null;
				if (st.state === "starting") return (0, react.createElement)("div", { className: voice_module_css_default.livePill }, "正在启动麦克风...");
				const text = st.partial === "" ? "正在听..." : st.partial;
				return (0, react.createElement)("div", { className: voice_module_css_default.livePill }, (0, react.createElement)(PendingIcon), text);
			}
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "voice-mic",
				order: 5
			}, MicButton));
			ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
				name: "conversation.input.overlay",
				id: "voice-live",
				order: 5
			}, () => (0, react.createElement)(LiveOverlay)));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map