# Seewo智学网自动答题脚本

## 功能特性

✅ **提取所有选项** - 自动解析当前题目的所有选项
✅ **智能选择答案** - 支持输入选项字母快速选择
✅ **题目导航** - 下一题/上一题/交卷功能
✅ **实时显示** - 显示当前题号和题目信息
✅ **可视化面板** - 浮窗式控制面板
✅ **控制台API** - 支持开发者控制台执行命令

---

## 安装步骤

### 方法1：Tampermonkey浏览器扩展安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展
   - Chrome: https://chrome.google.com/webstore/
   - Firefox: https://addons.mozilla.org/firefox/
   - Edge: Microsoft Edge Add-ons

2. 在Tampermonkey中创建新脚本，复制 `auto_answer.js` 的内容

3. 保存脚本（Ctrl+S）

4. 访问答题页面，脚本会自动启用

### 方法2：浏览器开发者工具安装

1. 打开答题页面，按 F12 打开开发者工具

2. 进入 Console（控制台）标签页

3. 复制整个脚本内容（去掉Tampermonkey头注释）

4. 粘贴到控制台执行

---

## 使用方法

### UI界面操作

脚本会在页面右上角显示**自动答题面板**：

```
🤖 自动答题面板
[输入答案框]
[✓选择答案] [📋显示题目]
[←上一题] [下一题→]
[📤交卷]
```

**步骤：**
1. 在输入框中输入答案选项（A/B/C/D）
2. 点击 **✓选择答案** 或按 Enter
3. 点击 **下一题 →** 进行下一题
4. 重复直到全部答题
5. 点击 **📤交卷** 提交答卷

### 控制台命令

打开浏览器开发者工具（F12），在 Console 标签页执行命令：

```javascript
// 1. 选择答案
Answer.select('A')   // 选择选项A
Answer.select('B')   // 选择选项B
Answer.select('C')   // 选择选项C
Answer.select('D')   // 选择选项D

// 2. 显示当前题目信息
Answer.info()        // 打印题目详情

// 3. 显示所有选项
Answer.options()     // 返回选项数组

// 4. 下一题
Answer.next()        // 下一题

// 5. 上一题
Answer.prev()        // 上一题

// 6. 交卷
Answer.submit()      // 交卷并提交
```

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+A | 显示帮助信息 |
| Enter（在输入框）| 快速选择答案 |

---

## 高级用法

### 批量答题脚本示例

在控制台执行以下脚本，自动连续答题：

```javascript
// 快速答题 - A选项（需要根据实际答案修改）
async function autoAnswer() {
    const answers = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
    
    for (let i = 0; i < answers.length; i++) {
        console.log(`正在回答第 ${i+1} 题...`);
        Answer.select(answers[i]);
        
        if (i < answers.length - 1) {
            Answer.next();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('✓ 所有题目已答题，请确认后交卷');
}

// 执行
autoAnswer();
```

### 获取所有题目信息

```javascript
// 遍历所有题目并打印信息
async function getAllQuestions() {
    const questions = [];
    
    Answer.info();  // 打印第一题
    questions.push({
        number: 1,
        question: document.querySelector('.title-B4SlM p.content-edHC-').textContent,
        options: Answer.options()
    });
    
    // 继续遍历...
    console.log(JSON.stringify(questions, null, 2));
}
```

---

## 常见问题

### Q1: 脚本没有出现控制面板？
**A:** 
- 检查Tampermonkey是否启用
- 刷新页面（Ctrl+R）
- 打开开发者工具（F12）查看 Console 是否有错误

### Q2: 选项点击无效？
**A:**
- 确认输入的是大写字母（A/B/C/D）
- 检查是否正确识别了选项
- 使用 `Answer.options()` 查看识别的选项

### Q3: 下一题按钮无法点击？
**A:**
- 某些题目可能需要先选择答案
- 确认不是已在最后一题

### Q4: 交卷后无法继续答题？
**A:**
- 交卷是不可逆操作，脚本会显示确认对话框
- 如需继续，请刷新页面重新开始

---

## 技术细节

### DOM选择器说明

```javascript
// 题目标题
.title-B4SlM p.content-edHC-

// 选项容器
.option-item-2nxPs

// 选项文字
.content-1IAZc

// 题号/总数
.left-2I6yX span

// 按钮组
.ant-btn (下一题、上一题、交卷)
```

### 函数API

| 函数 | 功能 | 返回值 |
|------|------|--------|
| `getAllOptions()` | 获取所有选项 | 选项对象数组 |
| `getCurrentQuestion()` | 获取当前题目 | {text, options} |
| `getQuestionInfo()` | 获取题号信息 | {current, total} |
| `selectOption(letter)` | 选择选项 | boolean |
| `nextQuestion()` | 下一题 | boolean |
| `previousQuestion()` | 上一题 | boolean |
| `submitAnswer()` | 交卷 | boolean |
| `printCurrentQuestion()` | 打印题目 | undefined |

---

## 免责声明

⚠️ 此脚本仅供学习研究使用，请遵守以下规则：

- ✅ 用于个人学习和复习
- ✅ 用于理解题目和教学
- ❌ 不得用于不诚实的考试作弊
- ❌ 不得违反学校/机构的规定
- ❌ 不得用于非法用途

**使用者需自行承担使用此脚本的一切后果。**

---

## 更新日志

### v1.0 (2024)
- ✅ 基础功能完成
- ✅ UI面板创建
- ✅ 控制台API导出
- ✅ 快捷键支持

---

## 支持和反馈

如遇问题，请检查：
1. 打开 F12 开发者工具
2. 在 Console 查看错误信息
3. 确认网页URL是否匹配脚本规则

---

**祝你答题愉快！** 🎓
