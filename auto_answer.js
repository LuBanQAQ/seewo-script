// ==UserScript==
// @name         Seewo智学网自动答题 AI版
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动答题脚本，支持AI自动回答、自动切换题目、自动交卷
// @author       LuBanQAQ
// @match        https://pinco.seewo.com/teacher/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 配置与状态管理
    // ==========================================
    const DEFAULT_CONFIG = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiToken: '',
        model: 'gpt-3.5-turbo',
        customBody: '{}',
        autoSubmit: false
    };

    let state = {
        isAutoRunning: false,
        autoLoopTimer: null,
        currentOptions: []
    };

    function getConfig() {
        return {
            apiUrl: GM_getValue('apiUrl', DEFAULT_CONFIG.apiUrl),
            apiToken: GM_getValue('apiToken', DEFAULT_CONFIG.apiToken),
            model: GM_getValue('model', DEFAULT_CONFIG.model),
            customBody: GM_getValue('customBody', DEFAULT_CONFIG.customBody),
            autoSubmit: GM_getValue('autoSubmit', DEFAULT_CONFIG.autoSubmit)
        };
    }

    function saveConfig(newConfig) {
        for (let key in newConfig) {
            GM_setValue(key, newConfig[key]);
        }
        showStatus('✅ 配置已保存');
    }

    // ==========================================
    // 2. DOM 操作与题目识别
    // ==========================================

    // 获取题目类型
    function getQuestionType() {
        const typeElement = document.querySelector('.title-B4SlM .label-362aA .icon-15MxH');
        if (typeElement) {
            const text = typeElement.textContent.trim();
            if (text.includes('单选题')) return 'single';
            if (text.includes('多选题')) return 'multiple';
            if (text.includes('判断题')) return 'judgment';
            if (text.includes('简答题')) return 'short';
        }
        return 'unknown';
    }

    // 获取所有选项 DOM
    function getAllOptions() {
        const optionElements = document.querySelectorAll('.option-item-2nxPs');
        const options = [];
        
        optionElements.forEach((element, index) => {
            const checkbox = element.querySelector('.check-box-1frsD');
            const content = element.querySelector('.content-1IAZc');
            
            if (checkbox && content) {
                options.push({
                    letter: checkbox.textContent.trim(),
                    text: content.textContent.trim(),
                    element: element,
                    index: index
                });
            }
        });
        return options;
    }

    // 获取当前题目完整文本（用于发给AI）
    function getQuestionContext() {
        const titleElement = document.querySelector('.title-B4SlM p.content-edHC-');
        const questionText = titleElement ? titleElement.textContent.trim() : '';
        const type = getQuestionType();
        const options = getAllOptions();
        
        let context = `题目类型：${type}\n题目内容：${questionText}\n`;
        if (options.length > 0) {
            context += `选项：\n`;
            options.forEach(opt => {
                context += `${opt.letter}. ${opt.text}\n`;
            });
        }
        return { text: context, type: type, options: options, rawQuestion: questionText };
    }

    // 选择选项
    function selectOption(optionInput) {
        const question = getQuestionContext();
        
        if (question.type === 'short') {
            return fillShortAnswer(optionInput);
        }

        // 处理输入，支持 "A,B" 或 "AB" 或 "A B"
        let inputs = optionInput.toUpperCase().split(/[,，\s]+/).filter(s => s);
        // 如果是多选题且输入是一个字符串如 "ABC"，拆分它
        if (inputs.length === 1 && inputs[0].length > 1 && question.type === 'multiple') {
             inputs = inputs[0].split('');
        }

        let success = false;
        inputs.forEach(letter => {
            // 判断题映射
            if (question.type === 'judgment') {
                if (letter === 'A' || letter === '对' || letter === 'T') letter = 'T';
                if (letter === 'B' || letter === '错' || letter === 'F') letter = 'F';
            }

            const option = question.options.find(opt => opt.letter.toUpperCase() === letter);
            if (option) {
                option.element.click();
                console.log(`✓ 已选择选项: ${letter}`);
                success = true;
            }
        });
        return success;
    }

    // 填写简答题
    function fillShortAnswer(content) {
        const editor = document.querySelector('.public-DraftEditor-content');
        if (editor) {
            console.log('找到简答题编辑器，准备写入答案...');
            editor.focus();
            
            // 方案1：模拟粘贴事件 (Paste Event)
            // 这是处理 Draft.js 等富文本编辑器最安全的方式，因为它会触发编辑器内部的 handlePaste 逻辑
            try {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', content);
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                });
                editor.dispatchEvent(pasteEvent);
                console.log('已触发粘贴事件');
            } catch (e) {
                console.warn('粘贴事件模拟失败:', e);
            }

            // 方案2：execCommand (作为补充)
            // 延时检查内容是否写入，如果没有，则尝试 execCommand
            setTimeout(() => {
                const currentText = editor.textContent || '';
                // 简单检查：如果编辑器内容不包含答案的前几个字符
                if (!currentText.includes(content.substring(0, Math.min(content.length, 10)))) {
                    console.log('粘贴未生效，尝试使用 execCommand 插入文本');
                    try {
                        // 注意：不建议手动操作 Range 全选，容易导致 React 状态不一致从而白屏
                        // 直接在当前光标位置插入
                        document.execCommand('insertText', false, content);
                    } catch (e) {
                        console.warn('execCommand 失败:', e);
                    }
                }
            }, 200);
            
            console.log('📝 已尝试填写简答题');
            return true;
        }
        return false;
    }

    // 下一题
    function nextQuestion() {
        const buttons = document.querySelectorAll('.ant-btn');
        for (let btn of buttons) {
            if (btn.textContent.includes('下一题')) {
                // 如果按钮被禁用，说明是最后一题
                if (btn.disabled || btn.hasAttribute('disabled')) {
                    return false;
                }
                btn.click();
                return true;
            }
        }
        return false;
    }

    // 上一题
    function prevQuestion() {
        const buttons = document.querySelectorAll('.ant-btn');
        for (let btn of buttons) {
            if (btn.textContent.includes('上一题')) {
                if (!btn.disabled) {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    // 交卷
    function submitAnswer() {
        const buttons = document.querySelectorAll('.ant-btn');
        for (let btn of buttons) {
            if (btn.textContent.includes('交 卷') || btn.textContent.includes('交卷')) {
                btn.click();
                console.log('已点击交卷按钮，等待确认弹窗...');
                
                // 自动确认弹窗
                setTimeout(() => {
                    // 策略1：查找所有模态框中的主要按钮，匹配文字
                    const primaryBtns = document.querySelectorAll('.ant-modal-root .ant-btn-primary');
                    let confirmBtn = null;
                    
                    for (let b of primaryBtns) {
                        // 检查按钮是否可见
                        if (b.offsetParent !== null) {
                            const text = b.textContent.trim();
                            if (text.includes('确定') || text.includes('确 定')) {
                                confirmBtn = b;
                                break;
                            }
                        }
                    }
                    
                    // 策略2：如果没找到特定文字的，尝试直接用选择器找可见的按钮
                    if (!confirmBtn) {
                        const candidates = document.querySelectorAll('.ant-modal-footer .ant-btn-primary');
                        for (let b of candidates) {
                            if (b.offsetParent !== null) {
                                confirmBtn = b;
                                break;
                            }
                        }
                    }

                    if (confirmBtn) {
                        console.log('检测到交卷确认弹窗，正在点击确定...');
                        confirmBtn.click();
                    } else {
                        console.warn('未找到交卷确认按钮，请手动点击');
                    }
                }, 1000);
                return true;
            }
        }
        return false;
    }

    // ==========================================
    // 3. AI 交互逻辑
    // ==========================================
    function callAIAPI(questionContext) {
        return new Promise((resolve, reject) => {
            const config = getConfig();
            if (!config.apiUrl || !config.apiToken) {
                reject(new Error('请先在设置中配置 API URL 和 Token'));
                return;
            }

            const prompt = `你是一个智能答题助手。请根据以下题目信息，直接给出答案。
            
${questionContext.text}

请严格按照以下 JSON 格式返回答案，不要包含任何 Markdown 标记或其他文字：
{"answer": "A"} (单选)
{"answer": "A,B"} (多选)
{"answer": "T"} (判断题，T是对，F是错)
{"answer": "答案内容"} (简答题)
`;

            let payload = {
                model: config.model,
                messages: [
                    { role: "user", content: prompt }
                ],
                stream: false
            };

            if (config.customBody) {
                try {
                    const customParams = JSON.parse(config.customBody);
                    payload = { ...payload, ...customParams };
                } catch (e) {
                    console.warn('自定义参数解析失败');
                }
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: config.apiUrl,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiToken}`
                },
                data: JSON.stringify(payload),
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const res = JSON.parse(response.responseText);
                            const content = res.choices[0].message.content;
                            // 清理可能存在的 markdown 标记
                            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
                            const json = JSON.parse(cleanContent);
                            resolve(json.answer);
                        } catch (e) {
                            reject(new Error('解析 AI 响应失败: ' + e.message));
                        }
                    } else {
                        reject(new Error(`API 请求失败: ${response.status} ${response.statusText}`));
                    }
                },
                onerror: function(err) {
                    reject(new Error('网络请求错误'));
                }
            });
        });
    }

    async function runAI(isAuto) {
        if (isAuto && !state.isAutoRunning) return;

        const question = getQuestionContext();
        if (!question.rawQuestion) {
            showStatus('⚠️ 未检测到题目');
            if (isAuto) stopAutoLoop();
            return;
        }

        showStatus('🤖 AI 正在思考...');
        
        try {
            const answer = await callAIAPI(question);
            showStatus(`✅ AI 答案: ${answer}`);
            
            const success = selectOption(answer);
            if (!success && question.type !== 'short') {
                showStatus(`❌ 无法选择选项: ${answer}`);
            }

            if (isAuto) {
                showStatus('⏳ 3秒后进入下一题...');
                state.autoLoopTimer = setTimeout(() => {
                    if (nextQuestion()) {
                        // 等待页面加载
                        setTimeout(() => runAI(true), 2000);
                    } else {
                        // 最后一题
                        const config = getConfig();
                        if (config.autoSubmit) {
                            showStatus('🏁 正在自动交卷...');
                            submitAnswer();
                        } else {
                            showStatus('🏁 已到达最后，请手动交卷');
                            stopAutoLoop();
                        }
                    }
                }, 3000);
            }

        } catch (error) {
            showStatus(`❌ 错误: ${error.message}`);
            if (isAuto) stopAutoLoop();
        }
    }

    function startAutoLoop() {
        state.isAutoRunning = true;
        document.getElementById('ai-auto-start').style.display = 'none';
        document.getElementById('ai-auto-stop').style.display = 'flex';
        runAI(true);
    }

    function stopAutoLoop() {
        state.isAutoRunning = false;
        if (state.autoLoopTimer) clearTimeout(state.autoLoopTimer);
        document.getElementById('ai-auto-start').style.display = 'flex';
        document.getElementById('ai-auto-stop').style.display = 'none';
        showStatus('⏹ 已停止自动答题');
    }

    // ==========================================
    // 4. UI 界面构建
    // ==========================================
    function createGUI() {
        // 注入 CSS
        GM_addStyle(`
            #seewo-ai-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 320px;
                background: #fff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-radius: 8px;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 14px;
                color: #333;
                border: 1px solid #ebeef5;
            }
            #seewo-ai-header {
                padding: 12px 16px;
                border-bottom: 1px solid #ebeef5;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f5f7fa;
                border-radius: 8px 8px 0 0;
                cursor: move;
            }
            .panel-title { font-weight: 600; color: #409eff; display: flex; align-items: center; gap: 6px; }
            .panel-btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; color: #909399; padding: 0 4px; }
            .panel-btn-icon:hover { color: #409eff; }
            
            #seewo-ai-content { padding: 16px; }
            
            .status-box {
                background: #ecf5ff;
                color: #409eff;
                padding: 8px 12px;
                border-radius: 4px;
                margin-bottom: 12px;
                font-size: 12px;
                line-height: 1.4;
                word-break: break-all;
            }
            
            .control-group { display: flex; gap: 8px; margin-bottom: 12px; }
            .btn {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            .btn-primary { background: #409eff; color: white; }
            .btn-primary:hover { background: #66b1ff; }
            .btn-success { background: #67c23a; color: white; }
            .btn-success:hover { background: #85ce61; }
            .btn-warning { background: #e6a23c; color: white; }
            .btn-warning:hover { background: #ebb563; }
            .btn-danger { background: #f56c6c; color: white; }
            .btn-danger:hover { background: #f78989; }
            .btn-info { background: #909399; color: white; }
            
            .settings-panel {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 4px;
                margin-bottom: 12px;
                border: 1px solid #ebeef5;
                display: none;
            }
            .form-item { margin-bottom: 8px; }
            .form-label { display: block; font-size: 12px; color: #606266; margin-bottom: 4px; }
            .form-input {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid #dcdfe6;
                border-radius: 4px;
                font-size: 12px;
                box-sizing: border-box;
            }
            .form-input:focus { border-color: #409eff; outline: none; }
            
            #seewo-min-icon {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: #409eff;
                color: white;
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 12px rgba(0,0,0,0.2);
                z-index: 99999;
                font-size: 20px;
            }
        `);

        const config = getConfig();

        const panelHtml = `
            <div id="seewo-ai-panel">
                <div id="seewo-ai-header">
                    <div class="panel-title">🤖 Seewo AI 助手</div>
                    <div>
                        <button id="btn-settings" class="panel-btn-icon" title="设置">⚙️</button>
                        <button id="btn-minimize" class="panel-btn-icon" title="最小化">➖</button>
                    </div>
                </div>
                <div id="seewo-ai-content">
                    <div id="status-msg" class="status-box">准备就绪</div>
                    
                    <!-- 设置面板 -->
                    <div id="settings-box" class="settings-panel">
                        <div class="form-item">
                            <label class="form-label">API URL</label>
                            <input type="text" id="cfg-url" class="form-input" value="${config.apiUrl}">
                        </div>
                        <div class="form-item">
                            <label class="form-label">API Token</label>
                            <input type="password" id="cfg-token" class="form-input" value="${config.apiToken}">
                        </div>
                        <div class="form-item">
                            <label class="form-label">Model</label>
                            <input type="text" id="cfg-model" class="form-input" value="${config.model}">
                        </div>
                        <div class="form-item">
                            <label class="form-label">自定义参数 (JSON)</label>
                            <textarea id="cfg-custom" class="form-input" style="height: 50px;">${config.customBody}</textarea>
                        </div>
                        <button id="btn-save-cfg" class="btn btn-primary" style="width: 100%">保存配置</button>
                    </div>

                    <!-- AI 控制 -->
                    <div class="control-group">
                        <button id="ai-solve-one" class="btn btn-primary">🤖 单题解答</button>
                    </div>
                    <div class="control-group">
                        <button id="ai-auto-start" class="btn btn-success">🚀 全自动开始</button>
                        <button id="ai-auto-stop" class="btn btn-info" style="display: none;">⏹ 停止运行</button>
                    </div>

                    <!-- 导航控制 -->
                    <div class="control-group">
                        <button id="btn-prev" class="btn btn-warning">← 上一题</button>
                        <button id="btn-next" class="btn btn-warning">下一题 →</button>
                    </div>

                    <!-- 底部控制 -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #ebeef5;">
                        <button id="btn-submit" class="btn btn-danger" style="flex: 1;">📤 交卷</button>
                        <label style="font-size: 12px; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="chk-auto-submit" ${config.autoSubmit ? 'checked' : ''}> 自动交卷
                        </label>
                    </div>
                </div>
            </div>
            <div id="seewo-min-icon" title="点击恢复">🤖</div>
        `;

        const div = document.createElement('div');
        div.innerHTML = panelHtml;
        document.body.appendChild(div);

        // 绑定事件
        bindEvents();
        makeDraggable(document.getElementById('seewo-ai-panel'), document.getElementById('seewo-ai-header'));
        
        // 让最小化图标也可拖动
        const minIcon = document.getElementById('seewo-min-icon');
        makeDraggable(minIcon, minIcon);
    }

    function showStatus(msg) {
        const el = document.getElementById('status-msg');
        if (el) {
            el.textContent = msg;
            // 自动滚动到底部（如果是多行）
        }
    }

    function bindEvents() {
        // 最小化/恢复
        const panel = document.getElementById('seewo-ai-panel');
        const minIcon = document.getElementById('seewo-min-icon');
        
        document.getElementById('btn-minimize').onclick = () => {
            panel.style.display = 'none';
            minIcon.style.display = 'flex';
        };
        minIcon.onclick = () => {
            minIcon.style.display = 'none';
            panel.style.display = 'block';
        };

        // 设置开关
        document.getElementById('btn-settings').onclick = () => {
            const box = document.getElementById('settings-box');
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
        };

        // 保存配置
        document.getElementById('btn-save-cfg').onclick = () => {
            saveConfig({
                apiUrl: document.getElementById('cfg-url').value,
                apiToken: document.getElementById('cfg-token').value,
                model: document.getElementById('cfg-model').value,
                customBody: document.getElementById('cfg-custom').value
            });
        };

        // 自动交卷开关
        document.getElementById('chk-auto-submit').onchange = (e) => {
            saveConfig({ autoSubmit: e.target.checked });
        };

        // 按钮功能
        document.getElementById('ai-solve-one').onclick = () => runAI(false);
        document.getElementById('ai-auto-start').onclick = startAutoLoop;
        document.getElementById('ai-auto-stop').onclick = stopAutoLoop;
        document.getElementById('btn-prev').onclick = prevQuestion;
        document.getElementById('btn-next').onclick = nextQuestion;
        document.getElementById('btn-submit').onclick = submitAnswer;
    }

    // 拖拽功能
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // 初始化
    window.addEventListener('load', function() {
        setTimeout(createGUI, 1000);
    });

})();
