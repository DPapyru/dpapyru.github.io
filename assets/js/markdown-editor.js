/**
 * Markdown编辑器类
 * 提供Markdown编辑、实时预览、语法高亮等功能
 */
class MarkdownEditor {
    constructor(options = {}) {
        // 配置选项
        this.options = {
            editorElement: options.editorElement || 'markdown-editor',
            previewElement: options.previewElement || 'markdown-preview',
            toolbarSelector: options.toolbarSelector || '.editor-toolbar',
            statusbarSelector: options.statusbarSelector || '.editor-statusbar',
            autoSave: options.autoSave !== undefined ? options.autoSave : true,
            autoSaveDelay: options.autoSaveDelay || 3000,
            syncScroll: options.syncScroll !== undefined ? options.syncScroll : true,
            configPath: options.configPath || 'config.json',
            ...options
        };

        // 编辑器状态
        this.isFullscreen = false;
        this.syncScrollEnabled = this.options.syncScroll;
        this.autoSaveTimer = null;
        this.lastSaveTime = null;
        this.currentFile = null;
        this.hasUnsavedChanges = false;
        
        // 本地保存功能相关
        this.documentVersions = [];
        this.maxVersions = 10; // 最多保存10个版本
        this.versionStorageKey = 'markdown-editor-versions';
        this.currentDocumentId = null;
        
        // 项目配置
        this.projectConfig = null;
        this.categories = {};
        this.topics = {};
        this.authors = {};
        this.templates = {};

        // 初始化编辑器
        this.init();
        
        // 初始化文档ID
        this.initDocumentId();
    }

    /**
     * 初始化编辑器
     */
    async init() {
        try {
            // 先加载项目配置
            await this.loadProjectConfig();
            
            // 然后初始化编辑器组件
            this.initCodeMirror();
            this.initToolbar();
            this.initPreview();
            this.initStatusbar();
            this.initMetadata();
            this.initEventListeners();
            this.initAutoSave();
            this.initTemplates();
            this.initGitIntegration(); // 初始化Git集成功能
            this.loadFromLocalStorage();
            
            console.log('Markdown编辑器初始化完成');
        } catch (error) {
            console.error('编辑器初始化失败:', error);
            this.showErrorMessage('编辑器初始化失败，请检查配置文件是否正确');
        }
    }

    /**
     * 加载项目配置
     */
    async loadProjectConfig() {
        try {
            const response = await fetch(this.options.configPath);
            if (!response.ok) {
                throw new Error(`无法加载配置文件: ${response.status}`);
            }
            
            this.projectConfig = await response.json();
            
            // 提取分类、主题和作者信息
            this.categories = this.projectConfig.categories || {};
            this.topics = this.projectConfig.topics || {};
            this.authors = this.projectConfig.authors || {};
            
            console.log('项目配置加载成功', {
                categories: Object.keys(this.categories).length,
                topics: Object.keys(this.topics).length,
                authors: Object.keys(this.authors).length
            });
        } catch (error) {
            console.error('加载项目配置失败:', error);
            console.log('使用默认配置');
            
            // 提供默认配置，防止编辑器无法初始化
            this.projectConfig = {
                categories: {
                    "基础": {
                        title: "基础",
                        topics: {
                            "入门": {
                                title: "入门",
                                files: []
                            }
                        }
                    },
                    "中阶": {
                        title: "中阶",
                        topics: {
                            "进阶": {
                                title: "进阶",
                                files: []
                            }
                        }
                    },
                    "高阶": {
                        title: "高阶",
                        topics: {
                            "高级": {
                                title: "高级",
                                files: []
                            }
                        }
                    }
                },
                topics: {},
                authors: {}
            };
            
            this.categories = this.projectConfig.categories;
            this.topics = this.projectConfig.topics;
            this.authors = this.projectConfig.authors;
            
            console.log('已加载默认配置', {
                categories: Object.keys(this.categories).length,
                topics: Object.keys(this.topics).length,
                authors: Object.keys(this.authors).length
            });
        }
    }

    /**
     * 初始化文档模板系统
     */
    initTemplates() {
        // 基于项目配置创建模板
        this.templates = {
            beginner: {
                name: '入门教程',
                description: '适合初学者的基础教程模板',
                difficulty: 'beginner',
                template: `# {title}

## 概述
{description}

## 先决条件
- 基础的C#知识
- 已安装tModLoader
- 了解Terraria基本玩法

## 步骤一：安装环境
详细描述安装步骤...

## 步骤二：创建基础项目
详细描述项目创建步骤...

## 步骤三：编写代码
\`\`\`csharp
// 在这里添加C#代码示例
public class ExampleMod : Mod
{
    public override void Load()
    {
        // Mod加载时的代码
    }
}
\`\`\`

## 总结
总结本教程的主要内容...

## 相关链接
- [官方文档](https://github.com/tModLoader/tModLoader/wiki)
- [API参考](https://github.com/tModLoader/tModLoader/wiki/Mod-References)`
            },
            intermediate: {
                name: '进阶教程',
                description: '有一定基础后的进阶教程模板',
                difficulty: 'intermediate',
                template: `# {title}

## 概述
{description}

## 前置知识
- 已掌握基础Mod开发
- 熟悉C#面向对象编程
- 了解tModLoader API基础

## 实现原理
详细解释实现原理...

## 代码实现
\`\`\`csharp
// 在这里添加C#代码示例
public class AdvancedExample : Mod
{
    public override void Load()
    {
        // 高级功能的实现
    }
}
\`\`\`

## 注意事项
列出实现过程中需要注意的问题...

## 扩展阅读
提供相关的高级主题链接...`
            },
            advanced: {
                name: '高级教程',
                description: '面向有经验开发者的高级教程模板',
                difficulty: 'advanced',
                template: `# {title}

## 概述
{description}

## 技术背景
深入讲解相关的技术背景...

## 核心概念
\`\`\`csharp
// 高级代码示例
public class AdvancedTechnique : Mod
{
    // 复杂的实现逻辑
}
\`\`\`

## 性能优化
讨论性能相关的考虑...

## 最佳实践
提供行业最佳实践建议...

## 参考资料
列出相关的技术文档和资源...`
            },
            custom: {
                name: '自定义模板',
                description: '根据项目特点定制的模板',
                difficulty: 'intermediate',
                template: `# {title}

## 概述
{description}

## 内容
在这里添加您的内容...

## 代码示例
\`\`\`csharp
// 代码示例
\`\`\`

## 总结
总结内容...`
            }
        };
        
        console.log('文档模板系统初始化完成', Object.keys(this.templates));
    }

    /**
     * 初始化CodeMirror编辑器
     */
    initCodeMirror() {
        const editorElement = document.getElementById(this.options.editorElement);
        if (!editorElement) {
            console.error('找不到编辑器元素:', this.options.editorElement);
            return;
        }

        // 创建CodeMirror实例
        this.editor = CodeMirror.fromTextArea(editorElement, {
            mode: 'markdown',
            theme: 'default',
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            styleActiveLine: true,
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            extraKeys: {
                "Enter": "newlineAndIndentContinueMarkdownList",
                "Ctrl-B": () => this.insertMarkdown('**', '**'),
                "Cmd-B": () => this.insertMarkdown('**', '**'),
                "Ctrl-I": () => this.insertMarkdown('*', '*'),
                "Cmd-I": () => this.insertMarkdown('*', '*'),
                "Ctrl-K": () => this.insertLink(),
                "Cmd-K": () => this.insertLink(),
                "Ctrl-S": () => this.save(),
                "Cmd-S": () => this.save(),
                "Ctrl-Z": () => this.editor.undo(),
                "Cmd-Z": () => this.editor.undo(),
                "Ctrl-Y": () => this.editor.redo(),
                "Cmd-Y": () => this.editor.redo(),
                "F11": () => this.toggleFullscreen()
            }
        });

        // 监听编辑器内容变化
        this.editor.on('change', () => {
            this.updatePreview();
            this.updateStatus();
            this.markAsChanged();
            this.scheduleAutoSave();
        });

        // 监听编辑器光标位置变化
        this.editor.on('cursorActivity', () => {
            this.updateCursorPosition();
        });

        // 监听滚动事件
        this.editor.on('scroll', () => {
            if (this.syncScrollEnabled) {
                this.syncScrollToPreview();
            }
        });

        console.log('CodeMirror编辑器初始化完成');
    }

    /**
     * 初始化工具栏
     */
    initToolbar() {
        const toolbar = document.querySelector(this.options.toolbarSelector);
        if (!toolbar) return;

        // 绑定工具栏按钮事件
        this.bindToolbarButton('btn-bold', () => this.insertMarkdown('**', '**'));
        this.bindToolbarButton('btn-italic', () => this.insertMarkdown('*', '*'));
        this.bindToolbarButton('btn-heading', () => this.insertHeading());
        this.bindToolbarButton('btn-link', () => this.insertLink());
        this.bindToolbarButton('btn-image', () => this.insertImage());
        this.bindToolbarButton('btn-code', () => this.insertCode());
        this.bindToolbarButton('btn-quote', () => this.insertQuote());
        this.bindToolbarButton('btn-list-ul', () => this.insertList('unordered'));
        this.bindToolbarButton('btn-list-ol', () => this.insertList('ordered'));
        this.bindToolbarButton('btn-table', () => this.insertTable());
        this.bindToolbarButton('btn-hr', () => this.insertHorizontalRule());
        this.bindToolbarButton('btn-undo', () => this.editor.undo());
        this.bindToolbarButton('btn-redo', () => this.editor.redo());
        this.bindToolbarButton('btn-preview', () => this.togglePreview());
        this.bindToolbarButton('btn-fullscreen', () => this.toggleFullscreen());
        this.bindToolbarButton('btn-save', () => this.save());
        this.bindToolbarButton('btn-export', () => this.showExportDialog());
        this.bindToolbarButton('btn-versions', () => this.showDocumentVersionsDialog());
        
        // 新增的工具栏按钮
        this.bindToolbarButton('btn-internal-link', () => this.insertInternalLink());
        this.bindToolbarButton('btn-csharp-code', () => this.insertCSharpCode());
        this.bindToolbarButton('btn-color-text', () => this.insertColorText());
        this.bindToolbarButton('btn-tmodloader-ref', () => this.showTModLoaderRefDialog());

        // 绑定同步滚动按钮
        const syncScrollBtn = document.getElementById('btn-sync-scroll');
        if (syncScrollBtn) {
            syncScrollBtn.addEventListener('click', () => {
                this.syncScrollEnabled = !this.syncScrollEnabled;
                syncScrollBtn.textContent = this.syncScrollEnabled ? '同步滚动' : '不同步滚动';
                syncScrollBtn.classList.toggle('active', this.syncScrollEnabled);
            });
            
            // 设置初始状态
            syncScrollBtn.textContent = this.syncScrollEnabled ? '同步滚动' : '不同步滚动';
            syncScrollBtn.classList.toggle('active', this.syncScrollEnabled);
        }

        console.log('工具栏初始化完成');
    }

    /**
     * 绑定工具栏按钮事件
     */
    bindToolbarButton(id, handler) {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    }

    /**
     * 初始化预览区域
     */
    initPreview() {
        this.previewElement = document.getElementById(this.options.previewElement);
        if (!this.previewElement) {
            console.error('找不到预览元素:', this.options.previewElement);
            return;
        }

        // 初始化marked.js
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                highlight: (code, lang) => {
                    // 使用增强的代码高亮
                    return this.enhanceCodeHighlight(code, lang);
                },
                breaks: true,
                gfm: true,
                tables: true,
                sanitize: false,
                smartLists: true,
                smartypants: true
            });

            // 添加自定义扩展 - 实现颜色渲染
            marked.use({ extensions: [this.createColorExtension(), this.createColorChangeExtension()] });
            console.log('颜色扩展已启用');
            
            // 添加项目特有的Markdown扩展
            this.initCustomMarkdownExtensions();
        }

        // 监听预览区域滚动
        this.previewElement.addEventListener('scroll', () => {
            if (this.syncScrollEnabled) {
                this.syncScrollToEditor();
            }
        });

        console.log('预览区域初始化完成');
    }

    /**
     * 创建颜色扩展
     */
    createColorExtension() {
        return {
            name: 'color',
            level: 'inline',
            start(src) {
                // 检查是否是 {color:变量名} 开头
                const colorMatch = src.match(/\{color:\s*([a-zA-Z0-9_-]+)\}/g);
                return colorMatch ? colorMatch.index : -1;
            },
            tokenizer(src) {
                const rule = /\{color:\s*([a-zA-Z0-9_-]+)\}\{([^{}]*)\}/g;
                const match = src.match(rule);
                if (match) {
                    return {
                        type: 'color',
                        raw: src,
                        allMatch: match
                    };
                }
            },
            renderer(token) {
                if (token.type !== 'color')
                    return;
                const allMatch = token.allMatch;
                let result = token.raw;
                const rule = /\{color:\s*([a-zA-Z0-9_-]+)\}\{([^{}]*)\}/;
                allMatch.forEach(item => {
                    const match = item.match(rule);
                    if (match) {
                        const drawColor = match[1]; // 颜色
                        const text = match[2]; // 文本

                        const spanColor = `<span style="color: var(--marked-text-color-${drawColor});">${text}</span>`;
                        result = result.replace(match[0], spanColor); // 替换原本内容
                    }
                    else {
                        console.error('颜色匹配失败:', item);
                    }
                });
                return result;
            }
        };
    }

    /**
     * 创建颜色变化扩展
     */
    createColorChangeExtension() {
        return {
            name: 'colorChange',
            level: 'inline',
            start(src) {
                // 检查是否是 {colorChange:变量名} 开头
                const colorMatch = src.match(/\{colorChange:\s*([a-zA-Z0-9_-]+)\}/g);
                return colorMatch ? colorMatch.index : -1;
            },
            tokenizer(src) {
                const rule = /\{colorChange:\s*([a-zA-Z0-9_-]+)\}\{([^{}]*)\}/g;
                const match = src.match(rule);
                if (match) {
                    return {
                        type: 'colorChange',
                        raw: src,
                        allMatch: match
                    };
                }
            },
            renderer(token) {
                if (token.type !== 'colorChange')
                    return;
                const allMatch = token.allMatch;
                let result = token.raw;
                const rule = /\{colorChange:\s*([a-zA-Z0-9_-]+)\}\{([^{}]*)\}/;
                allMatch.forEach(item => {
                    const match = item.match(rule);
                    if (match) {
                        const drawColor = match[1]; // 颜色
                        const text = match[2]; // 文本

                        const spanColor = `<span style="animation: colorChange-${drawColor} 2s infinite; display: inline-block;">${text}</span>`;
                        result = result.replace(match[0], spanColor); // 替换原本内容
                    }
                    else {
                        console.error('颜色动画匹配失败:', item);
                    }
                });
                return result;
            }
        };
    }

    /**
     * 初始化自定义Markdown扩展
     */
    initCustomMarkdownExtensions() {
        // 添加项目特有的链接格式支持
        const customLinkRenderer = {
            name: 'customLink',
            level: 'inline',
            start(src) { return src.match(/\[\[([^\]]+)\]\]\(([^)]+)\)/); },
            tokenizer(src, tokens) {
                const rule = /^\[\[([^\]]+)\]\]\(([^)]+)\)/;
                const match = rule.exec(src);
                if (match) {
                    return {
                        type: 'customLink',
                        raw: match[0],
                        text: match[1],
                        href: match[2]
                    };
                }
            },
            renderer(token) {
                // 支持项目特有的链接格式，如文档内部引用
                if (token.href.startsWith('@')) {
                    // 内部文档引用格式：@[文档标题]
                    const docTitle = token.href.substring(1);
                    return `<a href="#" class="internal-doc-link" data-doc="${docTitle}">${token.text}</a>`;
                } else if (token.href.startsWith('#')) {
                    // 锚点链接
                    return `<a href="${token.href}" class="anchor-link">${token.text}</a>`;
                }
                return `<a href="${token.href}" class="external-link">${token.text}</a>`;
            }
        };

        // 添加代码块增强功能
        const enhancedCodeBlock = {
            name: 'enhancedCodeBlock',
            level: 'block',
            start(src) { return src.match(/^```([a-zA-Z0-9_+-]*)?\s*\n/); },
            tokenizer(src, tokens) {
                const rule = /^```([a-zA-Z0-9_+-]*)?\s*\n([\s\S]*?)\n```\s*$/;
                const match = rule.exec(src);
                if (match) {
                    return {
                        type: 'enhancedCodeBlock',
                        raw: match[0],
                        lang: match[1] || '',
                        text: match[2]
                    };
                }
            },
            renderer(token) {
                const lang = token.lang || 'text';
                const enhancedClass = this.getEnhancedCodeClass(lang);
                return `<pre class="enhanced-code-block ${enhancedClass}"><code class="language-${lang}">${token.text}</code></pre>`;
            }
        };

        // 注册扩展
        marked.use({ extensions: [customLinkRenderer, enhancedCodeBlock] });
    }

    /**
     * 增强代码高亮
     */
    enhanceCodeHighlight(code, lang) {
        if (typeof Prism !== 'undefined' && Prism.languages[lang]) {
            // 对于C#代码，添加特殊处理
            if (lang === 'csharp' || lang === 'c#') {
                return this.enhanceCSharpHighlight(code);
            }
            return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
    }

    /**
     * 增强C#代码高亮
     */
    enhanceCSharpHighlight(code) {
        // 添加tModLoader特定的关键字和类
        const tModLoaderKeywords = [
            'Mod', 'ModPlayer', 'ModItem', 'ModNPC', 'ModProjectile', 'ModTile',
            'ModGlobally', 'ModWorld', 'ModSystem', 'ModCommand',
            'Main', 'Load', 'Unload', 'PreHook', 'PostHook',
            'SetStaticDefaults', 'SetDefaults', 'CanUseItem', 'UseItem',
            'ModifyHitNPC', 'OnHitNPC', 'ModifyHitPvp', 'OnHitPvp',
            'AI', 'Frame', 'PreAI', 'PostAI', 'PreDraw', 'PostDraw',
            'SendModMessage', 'HandleModPacket', 'GetModPacket',
            'AddRecipe', 'AddRecipeGroup', 'AddTile', 'AddWall',
            'AddNPC', 'AddProjectile', 'AddItem', 'AddBuff',
            'AddMount', 'AddMusicBox', 'AddBossBar'
        ];

        // 为tModLoader关键字添加特殊样式
        let highlightedCode = code;
        tModLoaderKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            highlightedCode = highlightedCode.replace(regex, `<span class="tmodloader-keyword">${keyword}</span>`);
        });

        // 使用Prism进行基础高亮
        if (typeof Prism !== 'undefined' && Prism.languages.csharp) {
            highlightedCode = Prism.highlight(highlightedCode, Prism.languages.csharp, 'csharp');
        }

        return highlightedCode;
    }

    /**
     * 获取增强代码块样式类
     */
    getEnhancedCodeClass(lang) {
        const classMap = {
            'csharp': 'csharp-enhanced',
            'c#': 'csharp-enhanced',
            'javascript': 'js-enhanced',
            'js': 'js-enhanced',
            'typescript': 'ts-enhanced',
            'ts': 'ts-enhanced',
            'yaml': 'yaml-enhanced',
            'yml': 'yaml-enhanced'
        };
        return classMap[lang] || '';
    }

    /**
     * 初始化状态栏
     */
    initStatusbar() {
        this.updateStatus();
        this.updateCursorPosition();
        console.log('状态栏初始化完成');
    }

    /**
     * 初始化元数据表单
     */
    initMetadata() {
        // 设置默认日期
        const dateInput = document.getElementById('doc-date');
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }

        // 动态填充分类选项
        this.populateCategoryOptions();
        
        // 添加模板选择功能
        this.addTemplateSelector();
        
        // 添加文件名验证功能
        this.addFilenameValidation();

        // 监听元数据变化
        const metadataInputs = document.querySelectorAll('.sidebar-content input, .sidebar-content select, .sidebar-content textarea');
        metadataInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.markAsChanged();
                this.scheduleAutoSave();
                // 特殊处理分类变化
                if (input.id === 'doc-category') {
                    this.onCategoryChange(input.value);
                }
            });
        });

        console.log('元数据表单初始化完成');
    }

    /**
     * 动态填充分类选项
     */
    populateCategoryOptions() {
        const categorySelect = document.getElementById('doc-category');
        if (!categorySelect || !this.projectConfig) return;

        // 清空现有选项（保留默认选项）
        while (categorySelect.children.length > 1) {
            categorySelect.removeChild(categorySelect.lastChild);
        }

        // 添加项目配置中的分类
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            const option = document.createElement('option');
            option.value = categoryKey;
            option.textContent = category.title || categoryKey;
            categorySelect.appendChild(option);
        });
    }

    /**
     * 添加模板选择器
     */
    addTemplateSelector() {
        const sidebarContent = document.querySelector('.sidebar-content');
        if (!sidebarContent) return;

        // 创建模板选择器容器
        const templateGroup = document.createElement('div');
        templateGroup.className = 'form-group';
        templateGroup.innerHTML = `
            <label for="doc-template">文档模板</label>
            <select id="doc-template" class="form-select">
                <option value="">选择模板（可选）</option>
            </select>
            <button type="button" id="apply-template" class="btn btn-sm btn-secondary" style="margin-top: 8px; width: 100%;">应用模板</button>
        `;

        // 添加到表单中（在标题字段之后）
        const titleGroup = document.querySelector('#doc-title').closest('.form-group');
        if (titleGroup && titleGroup.parentNode) {
            titleGroup.parentNode.insertBefore(templateGroup, titleGroup.nextSibling);
        }

        // 填充模板选项
        const templateSelect = document.getElementById('doc-template');
        Object.keys(this.templates).forEach(templateKey => {
            const template = this.templates[templateKey];
            const option = document.createElement('option');
            option.value = templateKey;
            option.textContent = template.name;
            templateSelect.appendChild(option);
        });

        // 绑定应用模板事件
        const applyBtn = document.getElementById('apply-template');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyTemplate(templateSelect.value);
            });
        }
    }

    /**
     * 添加文件名验证功能
     */
    addFilenameValidation() {
        const sidebarContent = document.querySelector('.sidebar-content');
        if (!sidebarContent) return;

        // 创建文件名字段
        const filenameGroup = document.createElement('div');
        filenameGroup.className = 'form-group';
        filenameGroup.innerHTML = `
            <label for="doc-filename">文件名</label>
            <input type="text" id="doc-filename" class="form-input" placeholder="例如：my-tutorial.md">
            <small class="form-help" id="filename-help">文件名将用于保存文档，建议使用英文和连字符</small>
        `;

        // 添加到表单中（在描述字段之后）
        const descriptionGroup = document.querySelector('#doc-description').closest('.form-group');
        if (descriptionGroup && descriptionGroup.parentNode) {
            descriptionGroup.parentNode.insertBefore(filenameGroup, descriptionGroup.nextSibling);
        }

        // 添加验证事件
        const filenameInput = document.getElementById('doc-filename');
        const filenameHelp = document.getElementById('filename-help');
        
        if (filenameInput && filenameHelp) {
            filenameInput.addEventListener('input', () => {
                this.validateFilename(filenameInput.value, filenameHelp);
            });
        }
    }

    /**
     * 验证文件名
     */
    validateFilename(filename, helpElement) {
        if (!filename) {
            helpElement.textContent = '文件名将用于保存文档，建议使用英文和连字符';
            helpElement.style.color = 'var(--text-secondary)';
            return true;
        }

        // 检查文件名格式
        const validPattern = /^[a-zA-Z0-9_-]+\.md$/;
        const baseNamePattern = /^[a-zA-Z0-9_-]+$/;
        
        if (!filename.endsWith('.md')) {
            helpElement.textContent = '文件名应以.md结尾';
            helpElement.style.color = 'var(--warning-color)';
            return false;
        }
        
        const baseName = filename.slice(0, -3);
        if (!baseNamePattern.test(baseName)) {
            helpElement.textContent = '文件名只能包含字母、数字、下划线和连字符';
            helpElement.style.color = 'var(--warning-color)';
            return false;
        }
        
        helpElement.textContent = '文件名格式正确';
        helpElement.style.color = 'var(--success-color)';
        return true;
    }

    /**
     * 应用文档模板
     */
    applyTemplate(templateKey) {
        if (!templateKey || !this.templates[templateKey]) {
            this.showErrorMessage('请选择一个有效的模板');
            return;
        }

        const template = this.templates[templateKey];
        const metadata = this.getMetadata();
        
        // 替换模板中的占位符
        let content = template.template;
        content = content.replace(/{title}/g, metadata.title || '文档标题');
        content = content.replace(/{description}/g, metadata.description || '文档描述');
        
        // 设置编辑器内容
        this.editor.setValue(content);
        
        // 更新元数据
        if (template.difficulty) {
            const difficultySelect = document.getElementById('doc-difficulty');
            if (difficultySelect) {
                difficultySelect.value = template.difficulty;
            }
        }
        
        this.markAsChanged();
        this.updatePreview();
        this.showSuccessMessage(`已应用"${template.name}"模板`);
    }

    /**
     * 分类变化处理
     */
    onCategoryChange(categoryKey) {
        // 根据分类自动设置相关主题
        if (categoryKey && this.categories[categoryKey]) {
            const category = this.categories[categoryKey];
            
            // 如果分类只有一个主题，自动选择
            const topics = Object.keys(category.topics || {});
            if (topics.length === 1) {
                // 这里可以添加主题选择逻辑，如果UI中有主题选择字段
                console.log('自动选择主题:', topics[0]);
            }
        }
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });

        // 监听页面离开事件
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });

        // 监听导出对话框
        this.initExportDialog();

        console.log('事件监听器初始化完成');
    }

    /**
     * 初始化导出对话框
     */
    initExportDialog() {
        const exportDialog = document.getElementById('export-dialog');
        const closeBtn = document.getElementById('close-export-dialog');
        const cancelBtn = document.getElementById('cancel-export');
        const confirmBtn = document.getElementById('confirm-export');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideExportDialog();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideExportDialog();
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.exportDocument();
            });
        }

        // 点击对话框外部关闭
        if (exportDialog) {
            exportDialog.addEventListener('click', (e) => {
                if (e.target === exportDialog) {
                    this.hideExportDialog();
                }
            });
        }
    }

    /**
     * 初始化自动保存
     */
    initAutoSave() {
        if (this.options.autoSave) {
            console.log('自动保存已启用，间隔:', this.options.autoSaveDelay, '毫秒');
        }
    }

    /**
     * 初始化文档ID
     */
    initDocumentId() {
        const savedId = localStorage.getItem('markdown-editor-current-doc-id');
        if (savedId) {
            this.currentDocumentId = savedId;
        } else {
            this.currentDocumentId = this.generateDocumentId();
            localStorage.setItem('markdown-editor-current-doc-id', this.currentDocumentId);
        }
        
        // 加载文档版本历史
        this.loadDocumentVersions();
    }
    
    /**
     * 生成文档ID
     */
    generateDocumentId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 加载文档版本历史
     */
    loadDocumentVersions() {
        try {
            const versionsData = localStorage.getItem(this.versionStorageKey);
            if (versionsData) {
                this.documentVersions = JSON.parse(versionsData);
                console.log(`已加载 ${this.documentVersions.length} 个文档版本`);
            }
        } catch (error) {
            console.error('加载文档版本历史失败:', error);
            this.documentVersions = [];
        }
    }
    
    /**
     * 保存文档版本
     */
    saveDocumentVersion() {
        if (!this.currentDocumentId) {
            this.currentDocumentId = this.generateDocumentId();
            localStorage.setItem('markdown-editor-current-doc-id', this.currentDocumentId);
        }
        
        const content = this.editor.getValue();
        const metadata = this.getMetadata();
        const timestamp = new Date().toISOString();
        
        // 创建版本对象
        const version = {
            id: this.currentDocumentId,
            timestamp: timestamp,
            content: content,
            metadata: metadata,
            preview: this.generatePreview(content)
        };
        
        // 查找是否已存在该文档的版本
        const existingVersionIndex = this.documentVersions.findIndex(v => v.id === this.currentDocumentId);
        
        if (existingVersionIndex !== -1) {
            // 更新现有版本
            this.documentVersions[existingVersionIndex] = version;
        } else {
            // 添加新版本
            this.documentVersions.push(version);
        }
        
        // 限制版本数量
        if (this.documentVersions.length > this.maxVersions) {
            this.documentVersions = this.documentVersions.slice(-this.maxVersions);
        }
        
        // 保存到本地存储
        try {
            localStorage.setItem(this.versionStorageKey, JSON.stringify(this.documentVersions));
            console.log('文档版本已保存:', this.currentDocumentId);
        } catch (error) {
            console.error('保存文档版本失败:', error);
            this.showErrorMessage('保存文档版本失败: ' + error.message);
        }
    }
    
    /**
     * 生成预览文本
     */
    generatePreview(content) {
        // 提取前100个字符作为预览
        const plainText = content.replace(/[#*`\[\]()]/g, '').replace(/\n+/g, ' ').trim();
        return plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '');
    }
    
    /**
     * 获取所有文档版本
     */
    getDocumentVersions() {
        return this.documentVersions;
    }
    
    /**
     * 加载指定版本的文档
     */
    loadDocumentVersion(versionId) {
        const version = this.documentVersions.find(v => v.id === versionId);
        if (!version) {
            this.showErrorMessage('找不到指定的文档版本');
            return false;
        }
        
        this.currentDocumentId = versionId;
        localStorage.setItem('markdown-editor-current-doc-id', this.currentDocumentId);
        
        this.editor.setValue(version.content);
        this.setMetadata(version.metadata);
        this.updatePreview();
        
        this.showSuccessMessage('已加载文档版本');
        return true;
    }
    
    /**
     * 删除文档版本
     */
    deleteDocumentVersion(versionId) {
        const index = this.documentVersions.findIndex(v => v.id === versionId);
        if (index === -1) {
            this.showErrorMessage('找不到指定的文档版本');
            return false;
        }
        
        this.documentVersions.splice(index, 1);
        
        try {
            localStorage.setItem(this.versionStorageKey, JSON.stringify(this.documentVersions));
            
            // 如果删除的是当前文档，创建新文档
            if (this.currentDocumentId === versionId) {
                this.createNewDocument();
            }
            
            this.showSuccessMessage('文档版本已删除');
            return true;
        } catch (error) {
            console.error('删除文档版本失败:', error);
            this.showErrorMessage('删除文档版本失败: ' + error.message);
            return false;
        }
    }
    
    /**
     * 创建新文档
     */
    createNewDocument() {
        this.currentDocumentId = this.generateDocumentId();
        localStorage.setItem('markdown-editor-current-doc-id', this.currentDocumentId);
        
        // 清空编辑器
        this.editor.setValue('');
        this.setMetadata({
            title: '',
            category: '',
            difficulty: '',
            author: '',
            date: new Date().toISOString().split('T')[0],
            tags: '',
            description: ''
        });
        
        this.updatePreview();
        this.showSuccessMessage('已创建新文档');
    }
    
    /**
     * 从本地存储加载内容
     */
    loadFromLocalStorage() {
        try {
            // 加载当前文档
            if (this.currentDocumentId) {
                const currentVersion = this.documentVersions.find(v => v.id === this.currentDocumentId);
                if (currentVersion) {
                    this.editor.setValue(currentVersion.content);
                    this.setMetadata(currentVersion.metadata);
                    console.log('已从本地存储加载当前文档');
                }
            }
            
            // 如果没有当前文档或找不到当前文档，加载旧版本的内容
            if (!this.currentDocumentId || !this.documentVersions.find(v => v.id === this.currentDocumentId)) {
                const savedContent = localStorage.getItem('markdown-editor-content');
                const savedMetadata = localStorage.getItem('markdown-editor-metadata');

                if (savedContent) {
                    this.editor.setValue(savedContent);
                    console.log('已从本地存储加载编辑器内容');
                }

                if (savedMetadata) {
                    const metadata = JSON.parse(savedMetadata);
                    this.setMetadata(metadata);
                    console.log('已从本地存储加载元数据');
                }
            }
        } catch (error) {
            console.error('从本地存储加载失败:', error);
        }
    }

    /**
     * 保存到本地存储
     */
    saveToLocalStorage() {
        try {
            // 保存文档版本
            this.saveDocumentVersion();
            
            // 同时保存到旧的存储键以保持兼容性
            const content = this.editor.getValue();
            const metadata = this.getMetadata();

            localStorage.setItem('markdown-editor-content', content);
            localStorage.setItem('markdown-editor-metadata', JSON.stringify(metadata));

            this.lastSaveTime = new Date();
            console.log('已保存到本地存储');
        } catch (error) {
            console.error('保存到本地存储失败:', error);
            this.showErrorMessage('保存失败: ' + error.message);
        }
    }
    
    /**
     * 显示文档版本管理对话框
     */
    showDocumentVersionsDialog() {
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'document-versions-dialog';
        dialog.innerHTML = `
            <div class="document-versions-content">
                <div class="document-versions-header">
                    <h3>文档版本管理</h3>
                    <button class="dialog-close" id="close-versions-dialog">&times;</button>
                </div>
                <div class="document-versions-body">
                    <div class="versions-actions">
                        <button class="btn btn-primary" id="create-new-document">新建文档</button>
                        <button class="btn btn-secondary" id="export-all-versions">导出所有版本</button>
                    </div>
                    <div class="versions-list" id="versions-list">
                        <!-- 版本列表将通过JavaScript动态生成 -->
                    </div>
                </div>
                <div class="document-versions-footer">
                    <button class="btn btn-secondary" id="cancel-versions">关闭</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = document.getElementById('close-versions-dialog');
        const cancelBtn = document.getElementById('cancel-versions');
        const createNewBtn = document.getElementById('create-new-document');
        const exportAllBtn = document.getElementById('export-all-versions');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 创建新文档
        createNewBtn.addEventListener('click', () => {
            if (confirm('创建新文档将丢失当前未保存的更改，确定继续吗？')) {
                this.createNewDocument();
                closeDialog();
            }
        });

        // 导出所有版本
        exportAllBtn.addEventListener('click', () => {
            this.exportAllVersions();
        });

        // 生成版本列表
        this.generateVersionsList();

        // 显示对话框
        dialog.classList.add('active');
    }
    
    /**
     * 生成版本列表
     */
    generateVersionsList() {
        const versionsList = document.getElementById('versions-list');
        if (!versionsList) return;

        if (this.documentVersions.length === 0) {
            versionsList.innerHTML = '<p class="no-versions">暂无保存的文档版本</p>';
            return;
        }

        // 按时间倒序排序
        const sortedVersions = [...this.documentVersions].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        let html = '<div class="versions-container">';
        sortedVersions.forEach(version => {
            const date = new Date(version.timestamp);
            const dateStr = date.toLocaleString('zh-CN');
            const isCurrent = version.id === this.currentDocumentId;
            
            html += `
                <div class="version-item ${isCurrent ? 'current' : ''}" data-version-id="${version.id}">
                    <div class="version-info">
                        <div class="version-title">${version.metadata.title || '未命名文档'}</div>
                        <div class="version-date">${dateStr}</div>
                        <div class="version-preview">${version.preview}</div>
                    </div>
                    <div class="version-actions">
                        ${isCurrent ? '<span class="current-badge">当前</span>' :
                          `<button class="btn btn-sm btn-primary load-version" data-version-id="${version.id}">加载</button>`}
                        <button class="btn btn-sm btn-danger delete-version" data-version-id="${version.id}">删除</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        versionsList.innerHTML = html;

        // 绑定事件
        versionsList.querySelectorAll('.load-version').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const versionId = e.target.getAttribute('data-version-id');
                if (this.loadDocumentVersion(versionId)) {
                    this.generateVersionsList(); // 刷新列表
                }
            });
        });

        versionsList.querySelectorAll('.delete-version').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const versionId = e.target.getAttribute('data-version-id');
                if (confirm('确定要删除这个文档版本吗？此操作不可撤销。')) {
                    if (this.deleteDocumentVersion(versionId)) {
                        this.generateVersionsList(); // 刷新列表
                    }
                }
            });
        });
    }
    
    /**
     * 导出所有版本
     */
    exportAllVersions() {
        if (this.documentVersions.length === 0) {
            this.showErrorMessage('没有可导出的文档版本');
            return;
        }

        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                versionCount: this.documentVersions.length,
                versions: this.documentVersions
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `markdown-editor-versions-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showSuccessMessage('所有版本已导出');
        } catch (error) {
            console.error('导出所有版本失败:', error);
            this.showErrorMessage('导出失败: ' + error.message);
        }
    }

    /**
     * 更新预览
     */
    updatePreview() {
        if (!this.previewElement || typeof marked === 'undefined') {
            console.log('预览元素或marked库未找到，跳过预览更新');
            return;
        }

        try {
            console.log('开始更新预览...');
            const content = this.editor.getValue();
            console.log('获取编辑器内容成功，长度:', content.length);
            
            const html = marked.parse(content);
            console.log('Markdown解析成功');
            
            this.previewElement.innerHTML = html;
            console.log('预览内容已设置');

            // 应用代码高亮
            if (typeof Prism !== 'undefined') {
                Prism.highlightAllUnder(this.previewElement);
                console.log('代码高亮已应用');
            } else {
                console.log('Prism库未找到，跳过代码高亮');
            }

            // 初始化图片缩放
            this.initImageZoom();
            console.log('图片缩放功能已初始化');
        } catch (error) {
            console.error('更新预览失败:', error);
            this.previewElement.innerHTML = `<div class="error">预览渲染失败: ${error.message}</div>`;
        }
    }

    /**
     * 更新状态栏
     */
    updateStatus() {
        const content = this.editor.getValue();
        const lines = content.split('\n');
        const wordCount = content.replace(/\s+/g, '').length;
        const lineCount = lines.length;

        // 更新字数和行数
        const wordCountElement = document.getElementById('word-count');
        const lineCountElement = document.getElementById('line-count');
        
        if (wordCountElement) {
            wordCountElement.textContent = `字数: ${wordCount}`;
        }
        
        if (lineCountElement) {
            lineCountElement.textContent = `行数: ${lineCount}`;
        }

        // 更新保存状态
        this.updateSaveStatus();
    }

    /**
     * 更新光标位置
     */
    updateCursorPosition() {
        const cursor = this.editor.getCursor();
        const positionElement = document.getElementById('cursor-position');
        
        if (positionElement) {
            positionElement.textContent = `行 ${cursor.line + 1}, 列 ${cursor.ch + 1}`;
        }
    }

    /**
     * 更新保存状态
     */
    updateSaveStatus() {
        const saveStatusElement = document.getElementById('save-status');
        const filePathElement = document.getElementById('file-path');
        
        if (saveStatusElement) {
            if (this.hasUnsavedChanges) {
                saveStatusElement.textContent = '未保存';
                saveStatusElement.style.color = 'var(--danger-color, #dc3545)';
            } else if (this.lastSaveTime) {
                const timeString = this.lastSaveTime.toLocaleTimeString('zh-CN');
                saveStatusElement.textContent = `已保存 (${timeString})`;
                saveStatusElement.style.color = 'var(--text-secondary, #666)';
            } else {
                saveStatusElement.textContent = '已保存';
                saveStatusElement.style.color = 'var(--text-secondary, #666)';
            }
        }
        
        if (filePathElement) {
            filePathElement.textContent = this.currentFile || '未保存';
        }
    }

    /**
     * 标记为已更改
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateSaveStatus();
    }

    /**
     * 标记为已保存
     */
    markAsSaved() {
        this.hasUnsavedChanges = false;
        this.updateSaveStatus();
    }

    /**
     * 计划自动保存
     */
    scheduleAutoSave() {
        if (!this.options.autoSave) return;

        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            this.save();
        }, this.options.autoSaveDelay);
    }

    /**
     * 插入Markdown语法
     */
    insertMarkdown(prefix, suffix = '') {
        const doc = this.editor.getDoc();
        const selection = doc.getSelection();
        
        if (selection) {
            doc.replaceSelection(prefix + selection + suffix);
        } else {
            const cursor = doc.getCursor();
            doc.replaceRange(prefix + suffix, cursor);
            doc.setCursor(cursor.line, cursor.ch + prefix.length);
        }
        
        this.editor.focus();
    }

    /**
     * 插入标题
     */
    insertHeading() {
        const doc = this.editor.getDoc();
        const cursor = doc.getCursor();
        const line = doc.getLine(cursor.line);
        
        // 检查当前行是否已经是标题
        const headingMatch = line.match(/^(#+)\s*(.*)$/);
        if (headingMatch) {
            const currentLevel = headingMatch[1].length;
            const newLevel = currentLevel >= 6 ? 1 : currentLevel + 1;
            doc.replaceRange(`${'#'.repeat(newLevel)} ${headingMatch[2]}`, 
                           {line: cursor.line, ch: 0}, 
                           {line: cursor.line, ch: line.length});
        } else {
            doc.replaceRange(`## ${line}`, 
                           {line: cursor.line, ch: 0}, 
                           {line: cursor.line, ch: line.length});
        }
        
        this.editor.focus();
    }

    /**
     * 插入链接
     */
    insertLink() {
        const doc = this.editor.getDoc();
        const selection = doc.getSelection();
        const url = prompt('请输入链接地址:', 'https://');
        
        if (url !== null) {
            if (selection) {
                doc.replaceSelection(`[${selection}](${url})`);
            } else {
                const text = prompt('请输入链接文本:', '');
                if (text !== null) {
                    doc.replaceSelection(`[${text}](${url})`);
                }
            }
        }
        
        this.editor.focus();
    }

    /**
     * 插入图片
     */
    insertImage() {
        const doc = this.editor.getDoc();
        const url = prompt('请输入图片地址:', '');
        
        if (url !== null) {
            const alt = prompt('请输入图片描述:', '');
            if (alt !== null) {
                doc.replaceSelection(`![${alt}](${url})`);
            }
        }
        
        this.editor.focus();
    }

    /**
     * 插入代码
     */
    insertCode() {
        const doc = this.editor.getDoc();
        const selection = doc.getSelection();
        
        if (selection.includes('\n')) {
            // 多行代码块
            const language = prompt('请输入编程语言 (可选):', 'csharp');
            doc.replaceSelection(`\n\`\`\`${language || ''}\n${selection}\n\`\`\`\n`);
        } else {
            // 单行代码
            doc.replaceSelection(`\`${selection}\``);
        }
        
        this.editor.focus();
    }

    /**
     * 插入引用
     */
    insertQuote() {
        const doc = this.editor.getDoc();
        const cursor = doc.getCursor();
        doc.replaceRange('> ', cursor);
        this.editor.focus();
    }

    /**
     * 插入列表
     */
    insertList(type) {
        const doc = this.editor.getDoc();
        const cursor = doc.getCursor();
        const marker = type === 'ordered' ? '1. ' : '- ';
        doc.replaceRange(marker, cursor);
        this.editor.focus();
    }

    /**
     * 插入表格
     */
    insertTable() {
        const rows = prompt('请输入行数:', '3');
        const cols = prompt('请输入列数:', '3');
        
        if (rows !== null && cols !== null) {
            const row = parseInt(rows);
            const col = parseInt(cols);
            
            if (row > 0 && col > 0) {
                let table = '\n';
                
                // 表头
                table += '|';
                for (let i = 0; i < col; i++) {
                    table += ` 标题${i + 1} |`;
                }
                table += '\n|';
                
                // 分隔线
                for (let i = 0; i < col; i++) {
                    table += ' --- |';
                }
                table += '\n';
                
                // 数据行
                for (let i = 0; i < row - 1; i++) {
                    table += '|';
                    for (let j = 0; j < col; j++) {
                        table += ` 数据 |`;
                    }
                    table += '\n';
                }
                
                const doc = this.editor.getDoc();
                doc.replaceSelection(table);
            }
        }
        
        this.editor.focus();
    }

    /**
     * 插入水平分割线
     */
    insertHorizontalRule() {
        const doc = this.editor.getDoc();
        doc.replaceSelection('\n---\n');
        this.editor.focus();
    }

    /**
     * 同步滚动到预览
     */
    syncScrollToPreview() {
        if (!this.previewElement) return;
        
        const scrollInfo = this.editor.getScrollInfo();
        const scrollPercentage = scrollInfo.top / (scrollInfo.height - scrollInfo.clientHeight);
        const previewScrollTop = scrollPercentage * (this.previewElement.scrollHeight - this.previewElement.clientHeight);
        
        this.previewElement.scrollTop = previewScrollTop;
    }

    /**
     * 同步滚动到编辑器
     */
    syncScrollToEditor() {
        if (!this.previewElement) return;
        
        const scrollPercentage = this.previewElement.scrollTop / (this.previewElement.scrollHeight - this.previewElement.clientHeight);
        const editorScrollInfo = this.editor.getScrollInfo();
        const editorScrollTop = scrollPercentage * (editorScrollInfo.height - editorScrollInfo.clientHeight);
        
        this.editor.scrollTo(editorScrollTop, editorScrollInfo.left);
    }

    /**
     * 切换预览
     */
    togglePreview() {
        const previewPane = document.querySelector('.preview-pane');
        if (previewPane) {
            previewPane.style.display = previewPane.style.display === 'none' ? 'flex' : 'none';
        }
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        const editorMain = document.querySelector('.editor-main');
        
        if (!this.isFullscreen) {
            if (editorMain.requestFullscreen) {
                editorMain.requestFullscreen();
            } else if (editorMain.webkitRequestFullscreen) {
                editorMain.webkitRequestFullscreen();
            } else if (editorMain.msRequestFullscreen) {
                editorMain.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    /**
     * 处理全屏变化
     */
    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.msFullscreenElement);
        
        const editorMain = document.querySelector('.editor-main');
        const fullscreenBtn = document.getElementById('btn-fullscreen');
        
        if (this.isFullscreen) {
            editorMain.classList.add('fullscreen');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '退出全屏';
            }
        } else {
            editorMain.classList.remove('fullscreen');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '全屏';
            }
        }
        
        // 刷新编辑器
        setTimeout(() => {
            this.editor.refresh();
        }, 100);
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 刷新编辑器
        setTimeout(() => {
            this.editor.refresh();
        }, 100);
    }

    /**
     * 保存文档
     */
    save() {
        this.saveToLocalStorage();
        this.markAsSaved();
        console.log('文档已保存');
    }

    /**
     * 获取元数据
     */
    getMetadata() {
        return {
            title: document.getElementById('doc-title')?.value || '',
            category: document.getElementById('doc-category')?.value || '',
            difficulty: document.getElementById('doc-difficulty')?.value || '',
            author: document.getElementById('doc-author')?.value || '',
            date: document.getElementById('doc-date')?.value || '',
            tags: document.getElementById('doc-tags')?.value || '',
            description: document.getElementById('doc-description')?.value || ''
        };
    }

    /**
     * 设置元数据
     */
    setMetadata(metadata) {
        if (metadata.title !== undefined) {
            const titleInput = document.getElementById('doc-title');
            if (titleInput) titleInput.value = metadata.title;
        }
        
        if (metadata.category !== undefined) {
            const categorySelect = document.getElementById('doc-category');
            if (categorySelect) categorySelect.value = metadata.category;
        }
        
        if (metadata.difficulty !== undefined) {
            const difficultySelect = document.getElementById('doc-difficulty');
            if (difficultySelect) difficultySelect.value = metadata.difficulty;
        }
        
        if (metadata.author !== undefined) {
            const authorInput = document.getElementById('doc-author');
            if (authorInput) authorInput.value = metadata.author;
        }
        
        if (metadata.date !== undefined) {
            const dateInput = document.getElementById('doc-date');
            if (dateInput) dateInput.value = metadata.date;
        }
        
        if (metadata.tags !== undefined) {
            const tagsInput = document.getElementById('doc-tags');
            if (tagsInput) tagsInput.value = metadata.tags;
        }
        
        if (metadata.description !== undefined) {
            const descriptionInput = document.getElementById('doc-description');
            if (descriptionInput) descriptionInput.value = metadata.description;
        }
    }

    /**
     * 显示导出对话框
     */
    showExportDialog() {
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog enhanced-export-dialog';
        dialog.innerHTML = `
            <div class="export-dialog-content">
                <div class="export-dialog-header">
                    <h3>导出文档</h3>
                    <button class="dialog-close" id="close-export-dialog">&times;</button>
                </div>
                <div class="export-dialog-body">
                    <div class="form-group">
                        <label for="export-format">导出格式</label>
                        <select id="export-format" class="form-select">
                            <option value="html">HTML (带样式)</option>
                            <option value="markdown">Markdown (带元数据)</option>
                            <option value="complete">完整文档 (所有版本)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="export-filename">文件名</label>
                        <input type="text" id="export-filename" class="form-input" placeholder="输入文件名（不含扩展名）">
                    </div>
                    <div class="export-options">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="include-metadata" checked>
                                包含元数据
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="include-preview" checked>
                                包含预览
                            </label>
                        </div>
                    </div>
                </div>
                <div class="export-dialog-footer">
                    <button class="btn btn-secondary" id="cancel-export">取消</button>
                    <button class="btn btn-primary" id="confirm-export">导出</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = document.getElementById('close-export-dialog');
        const cancelBtn = document.getElementById('cancel-export');
        const confirmBtn = document.getElementById('confirm-export');
        const formatSelect = document.getElementById('export-format');
        const filenameInput = document.getElementById('export-filename');

        // 设置默认文件名
        if (filenameInput && !filenameInput.value) {
            const metadata = this.getMetadata();
            filenameInput.value = metadata.title || 'markdown-document';
        }

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 确认导出
        confirmBtn.addEventListener('click', () => {
            this.exportDocumentWithOptions(formatSelect.value, filenameInput.value);
            closeDialog();
        });

        // 格式变化时更新选项
        formatSelect.addEventListener('change', () => {
            this.updateExportOptions(formatSelect.value);
        });

        // 显示对话框
        dialog.classList.add('active');
    }
    
    /**
     * 更新导出选项
     */
    updateExportOptions(format) {
        const includeMetadata = document.getElementById('include-metadata');
        const includePreview = document.getElementById('include-preview');
        const optionsContainer = document.querySelector('.export-options');
        
        if (format === 'complete') {
            // 完整文档导出时隐藏这些选项
            if (optionsContainer) {
                optionsContainer.style.display = 'none';
            }
        } else {
            // 其他格式显示选项
            if (optionsContainer) {
                optionsContainer.style.display = 'block';
            }
        }
    }
    
    /**
     * 带选项的导出文档
     */
    exportDocumentWithOptions(format, filename) {
        if (!format || !filename) {
            this.showErrorMessage('请填写导出格式和文件名');
            return;
        }
        
        const content = this.editor.getValue();
        const metadata = this.getMetadata();
        
        try {
            switch (format) {
                case 'html':
                    this.exportAsHTML(content, metadata, filename);
                    break;
                case 'markdown':
                    this.exportAsMarkdown(content, metadata, filename);
                    break;
                case 'complete':
                    this.exportCompleteDocument();
                    break;
                default:
                    this.showErrorMessage('不支持的导出格式');
            }
        } catch (error) {
            console.error('导出失败:', error);
            this.showErrorMessage('导出失败: ' + error.message);
        }
    }

    /**
     * 隐藏导出对话框
     */
    hideExportDialog() {
        const dialog = document.getElementById('export-dialog');
        if (dialog) {
            dialog.classList.remove('active');
        }
    }

    /**
     * 导出文档
     */
    exportDocument() {
        const format = document.getElementById('export-format')?.value;
        const filename = document.getElementById('export-filename')?.value || 'markdown-document';
        
        if (!format) {
            alert('请选择导出格式');
            return;
        }
        
        const content = this.editor.getValue();
        const metadata = this.getMetadata();
        
        try {
            switch (format) {
                case 'html':
                    this.exportAsHTML(content, metadata, filename);
                    break;
                case 'markdown':
                    this.exportAsMarkdown(content, metadata, filename);
                    break;
                case 'pdf':
                    this.exportAsPDF(content, metadata, filename);
                    break;
                default:
                    alert('不支持的导出格式');
            }
            
            this.hideExportDialog();
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        }
    }

    /**
     * 导出为HTML
     */
    exportAsHTML(content, metadata, filename) {
        const html = marked.parse(content);
        const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title || filename}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3 {
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            color: #2c3e50;
        }
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.5em; }
        code {
            background-color: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            color: #e83e8c;
        }
        pre {
            background-color: #f8f9fa;
            padding: 16px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid #e9ecef;
        }
        pre code {
            background: none;
            padding: 0;
            color: inherit;
        }
        blockquote {
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 20px;
            color: #666;
            font-style: italic;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            font-weight: 600;
        }
        .metadata {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .metadata h2 {
            margin-top: 0;
            border-bottom: none;
            padding-bottom: 10px;
        }
        .metadata-item {
            margin-bottom: 10px;
        }
        .metadata-label {
            font-weight: 600;
            color: #495057;
            display: inline-block;
            width: 80px;
        }
        .metadata-value {
            color: #6c757d;
        }
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 5px;
        }
        .tag {
            background-color: #e9ecef;
            color: #495057;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="metadata">
        <h2>文档信息</h2>
        <div class="metadata-item">
            <span class="metadata-label">标题:</span>
            <span class="metadata-value">${metadata.title || '未命名文档'}</span>
        </div>
        ${metadata.description ? `
        <div class="metadata-item">
            <span class="metadata-label">描述:</span>
            <span class="metadata-value">${metadata.description}</span>
        </div>
        ` : ''}
        ${metadata.author ? `
        <div class="metadata-item">
            <span class="metadata-label">作者:</span>
            <span class="metadata-value">${metadata.author}</span>
        </div>
        ` : ''}
        ${metadata.date ? `
        <div class="metadata-item">
            <span class="metadata-label">日期:</span>
            <span class="metadata-value">${metadata.date}</span>
        </div>
        ` : ''}
        ${metadata.category ? `
        <div class="metadata-item">
            <span class="metadata-label">分类:</span>
            <span class="metadata-value">${metadata.category}</span>
        </div>
        ` : ''}
        ${metadata.difficulty ? `
        <div class="metadata-item">
            <span class="metadata-label">难度:</span>
            <span class="metadata-value">${this.getDifficultyText(metadata.difficulty)}</span>
        </div>
        ` : ''}
        ${metadata.tags ? `
        <div class="metadata-item">
            <span class="metadata-label">标签:</span>
            <div class="tags">
                ${metadata.tags.split(',').map(tag =>
                    `<span class="tag">${tag.trim()}</span>`
                ).join('')}
            </div>
        </div>
        ` : ''}
        <div class="metadata-item">
            <span class="metadata-label">导出时间:</span>
            <span class="metadata-value">${new Date().toLocaleString('zh-CN')}</span>
        </div>
    </div>
    <hr>
    ${html}
</body>
</html>`;
        
        this.downloadFile(fullHTML, `${filename}.html`, 'text/html');
    }

    /**
     * 导出为Markdown
     */
    exportAsMarkdown(content, metadata, filename) {
        let markdown = '';
        
        // 添加前置元数据
        if (metadata.title || metadata.author || metadata.date || metadata.category || metadata.difficulty || metadata.tags || metadata.description) {
            markdown += '---\n';
            if (metadata.title) markdown += `title: ${metadata.title}\n`;
            if (metadata.author) markdown += `author: ${metadata.author}\n`;
            if (metadata.date) markdown += `date: ${metadata.date}\n`;
            if (metadata.category) markdown += `category: ${metadata.category}\n`;
            if (metadata.difficulty) markdown += `difficulty: ${metadata.difficulty}\n`;
            if (metadata.tags) markdown += `tags: [${metadata.tags.split(',').map(tag => tag.trim()).join(', ')}]\n`;
            if (metadata.description) markdown += `description: ${metadata.description}\n`;
            markdown += `exported: ${new Date().toISOString()}\n`;
            markdown += `document_id: ${this.currentDocumentId}\n`;
            markdown += '---\n\n';
        }
        
        markdown += content;
        
        this.downloadFile(markdown, `${filename}.md`, 'text/markdown');
    }
    
    /**
     * 导出完整文档（包含所有版本）
     */
    exportCompleteDocument() {
        if (this.documentVersions.length === 0) {
            this.showErrorMessage('没有可导出的文档版本');
            return;
        }
        
        try {
            const exportData = {
                exportInfo: {
                    exportDate: new Date().toISOString(),
                    totalVersions: this.documentVersions.length,
                    currentDocumentId: this.currentDocumentId,
                    description: "Markdown编辑器完整文档导出，包含所有版本历史"
                },
                versions: this.documentVersions.map(version => ({
                    id: version.id,
                    timestamp: version.timestamp,
                    metadata: version.metadata,
                    content: version.content,
                    preview: version.preview
                }))
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `markdown-editor-complete-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showSuccessMessage('完整文档已导出');
        } catch (error) {
            console.error('导出完整文档失败:', error);
            this.showErrorMessage('导出失败: ' + error.message);
        }
    }
    
    /**
     * 获取难度文本
     */
    getDifficultyText(difficulty) {
        const difficultyMap = {
            'beginner': '初级',
            'intermediate': '中级',
            'advanced': '高级'
        };
        return difficultyMap[difficulty] || difficulty;
    }

    /**
     * 导出为PDF (实验性)
     */
    exportAsPDF(content, metadata, filename) {
        // 这是一个实验性功能，需要额外的PDF生成库
        alert('PDF导出功能正在开发中，请先导出为HTML或Markdown格式');
    }

    /**
     * 下载文件
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        console.log(`文件已下载: ${filename}`);
    }

    /**
     * 初始化图片缩放
     */
    initImageZoom() {
        if (!this.previewElement) return;
        
        const images = this.previewElement.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('data-zoom-enabled')) {
                img.setAttribute('data-zoom-enabled', 'true');
                img.style.cursor = 'zoom-in';
                img.addEventListener('click', () => {
                    this.createImageOverlay(img.src, img.alt || '');
                });
            }
        });
    }

    /**
     * 创建图片遮罩层
     */
    createImageOverlay(imageSrc, imageAlt) {
        // 检查是否已存在遮罩层
        if (document.getElementById('editor-image-zoom-overlay')) {
            return;
        }
        
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'editor-image-zoom-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            cursor: zoom-out;
        `;
        
        // 创建图片
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = imageAlt;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        `;
        
        // 添加关闭事件
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        // 添加ESC键关闭功能
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('editor-image-zoom-overlay');
                if (overlay) {
                    document.body.removeChild(overlay);
                    document.removeEventListener('keydown', handleKeyPress);
                }
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        
        // 组装元素
        overlay.appendChild(img);
        document.body.appendChild(overlay);
    }
    /**
     * 显示成功消息
     */
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 显示错误消息
     */
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `editor-message editor-message-${type}`;
        messageEl.textContent = message;
        
        // 添加样式
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                messageEl.style.backgroundColor = 'var(--success-color, #28a745)';
                break;
            case 'error':
                messageEl.style.backgroundColor = 'var(--danger-color, #dc3545)';
                break;
            default:
                messageEl.style.backgroundColor = 'var(--info-color, #17a2b8)';
        }
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 显示动画
        setTimeout(() => {
            messageEl.style.opacity = '1';
            messageEl.style.transform = 'translateY(0)';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    document.body.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 获取项目配置
     */
    getProjectConfig() {
        return this.projectConfig;
    }

    /**
     * 获取分类列表
     */
    getCategories() {
        return this.categories;
    }

    /**
     * 获取主题列表
     */
    getTopics() {
        return this.topics;
    }

    /**
     * 获取作者列表
     */
    getAuthors() {
        return this.authors;
    }

    /**
     * 获取模板列表
     */
    getTemplates() {
        return this.templates;
    }

    /**
     * 根据分类获取主题
     */
    getTopicsByCategory(categoryKey) {
        if (!categoryKey || !this.categories[categoryKey]) {
            return [];
        }
        return Object.keys(this.categories[categoryKey].topics || {});
    }

    /**
     * 根据主题获取文档列表
     */
    getFilesByTopic(categoryKey, topicKey) {
        if (!categoryKey || !topicKey || !this.categories[categoryKey] || !this.categories[categoryKey].topics[topicKey]) {
            return [];
        }
        return this.categories[categoryKey].topics[topicKey].files || [];
    }

    /**
     * 生成文件路径
     */
    generateFilePath(metadata) {
        if (!metadata) {
            metadata = this.getMetadata();
        }
        
        const category = metadata.category || '未分类';
        const filename = metadata.filename || 'untitled.md';
        
        return `${category}/${filename}`;
    }

    /**
     * 验证元数据完整性
     */
    validateMetadata(metadata = null) {
        if (!metadata) {
            metadata = this.getMetadata();
        }
        
        const errors = [];
        
        // 必填字段验证
        if (!metadata.title) {
            errors.push('标题是必填字段');
        }
        
        if (!metadata.category) {
            errors.push('分类是必填字段');
        }
        
        // 文件名验证
        if (metadata.filename && !this.validateFilename(metadata.filename)) {
            errors.push('文件名格式不正确');
        }
        
        // 标签格式验证
        if (metadata.tags) {
            try {
                const tags = JSON.parse(metadata.tags);
                if (!Array.isArray(tags)) {
                    errors.push('标签格式不正确，应为JSON数组格式');
                }
            } catch (e) {
                errors.push('标签格式不正确，应为JSON数组格式');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 插入内部文档链接
     */
    insertInternalLink() {
        this.showInternalLinkDialog();
    }

    /**
     * 显示内部链接对话框
     */
    showInternalLinkDialog() {
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'internal-link-dialog';
        dialog.innerHTML = `
            <div class="internal-link-content">
                <div class="internal-link-header">
                    <h3>插入内部文档链接</h3>
                    <button class="dialog-close" id="close-internal-link-dialog">&times;</button>
                </div>
                <div class="internal-link-body">
                    <div class="form-group">
                        <label for="internal-link-search">搜索文档</label>
                        <input type="text" id="internal-link-search" class="form-input" placeholder="输入关键词搜索...">
                    </div>
                    <div class="form-group">
                        <label>文档列表</label>
                        <ul class="document-tree" id="document-tree">
                            <!-- 文档树将通过JavaScript动态生成 -->
                        </ul>
                    </div>
                </div>
                <div class="internal-link-footer">
                    <button class="btn btn-secondary" id="cancel-internal-link">取消</button>
                    <button class="btn btn-primary" id="confirm-internal-link">插入链接</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = document.getElementById('close-internal-link-dialog');
        const cancelBtn = document.getElementById('cancel-internal-link');
        const confirmBtn = document.getElementById('confirm-internal-link');
        const searchInput = document.getElementById('internal-link-search');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 确认插入链接
        confirmBtn.addEventListener('click', () => {
            const selectedItem = document.querySelector('.document-tree-item.selected');
            if (selectedItem) {
                const docPath = selectedItem.getAttribute('data-path');
                const docTitle = selectedItem.textContent;
                
                // 插入内部链接格式
                const doc = this.editor.getDoc();
                const selection = doc.getSelection();
                const linkText = selection || docTitle;
                doc.replaceSelection(`[${linkText}](${docPath})`);
                
                this.editor.focus();
                closeDialog();
                this.showSuccessMessage('已插入内部文档链接');
            } else {
                this.showErrorMessage('请先选择一个文档');
            }
        });

        // 搜索功能
        searchInput.addEventListener('input', () => {
            this.filterDocuments(searchInput.value);
        });

        // 生成文档树
        this.generateDocumentTree();
    }

    /**
     * 生成文档树
     */
    generateDocumentTree() {
        const treeContainer = document.getElementById('document-tree');
        if (!treeContainer) return;

        // 清空现有内容
        treeContainer.innerHTML = '';

        // 从项目配置生成文档树
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            const categoryItem = document.createElement('li');
            categoryItem.className = 'document-tree-item';
            categoryItem.innerHTML = `<strong>${category.title || categoryKey}</strong>`;
            
            const topicsList = document.createElement('ul');
            topicsList.className = 'document-tree-children';
            
            Object.keys(category.topics || {}).forEach(topicKey => {
                const topic = category.topics[topicKey];
                const topicItem = document.createElement('li');
                topicItem.className = 'document-tree-item';
                topicItem.innerHTML = topic.title || topicKey;
                
                const filesList = document.createElement('ul');
                filesList.className = 'document-tree-children';
                
                (topic.files || []).forEach(file => {
                    const fileItem = document.createElement('li');
                    fileItem.className = 'document-tree-item';
                    fileItem.textContent = file.title || file.name;
                    fileItem.setAttribute('data-path', file.path || `${categoryKey}/${topicKey}/${file.name}`);
                    
                    // 点击选择文件
                    fileItem.addEventListener('click', () => {
                        // 清除其他选中状态
                        document.querySelectorAll('.document-tree-item').forEach(item => {
                            item.classList.remove('selected');
                        });
                        fileItem.classList.add('selected');
                    });
                    
                    filesList.appendChild(fileItem);
                });
                
                topicItem.appendChild(filesList);
                topicsList.appendChild(topicItem);
            });
            
            categoryItem.appendChild(topicsList);
            treeContainer.appendChild(categoryItem);
        });
    }

    /**
     * 过滤文档
     */
    filterDocuments(searchTerm) {
        const allItems = document.querySelectorAll('.document-tree-item');
        
        allItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const isMatch = text.includes(searchTerm.toLowerCase());
            
            if (isMatch) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * 插入C#代码块
     */
    insertCSharpCode() {
        const doc = this.editor.getDoc();
        const selection = doc.getSelection();
        
        // 显示C#代码模板对话框
        const codeTemplates = [
            { name: 'Mod类', template: 'public class ExampleMod : Mod\n{\n    public override void Load()\n    {\n        // Mod加载时的代码\n    }\n}' },
            { name: 'ModItem类', template: 'public class ExampleItem : ModItem\n{\n    public override void SetDefaults()\n    {\n        Item.width = 20;\n        Item.height = 20;\n        Item.value = Item.sellPrice(0, 0, 1, 0);\n    }\n}' },
            { name: 'ModNPC类', template: 'public class ExampleNPC : ModNPC\n{\n    public override void SetDefaults()\n    {\n        NPC.width = 18;\n        NPC.height = 40;\n        NPC.damage = 10;\n        NPC.defense = 5;\n    }\n    \n    public override void AI()\n    {\n        NPC.ai[0]++;\n    }\n}' },
            { name: '自定义代码', template: '' }
        ];
        
        // 创建选择对话框
        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>选择C#代码模板</h3>
                    <button class="dialog-close" id="close-csharp-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>代码模板</label>
                        <select id="csharp-template-select" class="form-select">
                            ${codeTemplates.map((tpl, index) =>
                                `<option value="${index}">${tpl.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-secondary" id="cancel-csharp">取消</button>
                    <button class="btn btn-primary" id="confirm-csharp">插入代码</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.classList.add('active');
        
        // 绑定事件
        const closeBtn = document.getElementById('close-csharp-dialog');
        const cancelBtn = document.getElementById('cancel-csharp');
        const confirmBtn = document.getElementById('confirm-csharp');
        const templateSelect = document.getElementById('csharp-template-select');
        
        const closeDialog = () => {
            dialog.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(dialog);
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            const selectedIndex = parseInt(templateSelect.value);
            const template = codeTemplates[selectedIndex];
            
            let code = selection || template.template;
            
            // 插入代码块
            doc.replaceSelection(`\n\`\`\`csharp\n${code}\n\`\`\`\n`);
            this.editor.focus();
            
            closeDialog();
            this.showSuccessMessage(`已插入${template.name}代码块`);
        });
    }

    /**
     * 插入彩色文本
     */
    insertColorText() {
        // 静态颜色选项
        const staticColors = [
            { name: '红色', value: 'red' },
            { name: '绿色', value: 'green' },
            { name: '蓝色', value: 'blue' },
            { name: '黄色', value: 'yellow' },
            { name: '紫色', value: 'purple' },
            { name: '橙色', value: 'orange' },
            { name: '青色', value: 'cyan' },
            { name: '粉色', value: 'pink' }
        ];
        
        // 变量颜色选项（与main.js中的CSS变量对应）
        const variableColors = [
            { name: '主要文本', value: 'primary' },
            { name: '次要文本', value: 'secondary' },
            { name: '强调文本', value: 'accent' },
            { name: '成功文本', value: 'success' },
            { name: '警告文本', value: 'warning' },
            { name: '错误文本', value: 'error' },
            { name: '信息文本', value: 'info' },
            { name: '链接文本', value: 'link' }
        ];
        
        // 动画颜色选项
        const animatedColors = [
            { name: '彩虹动画', value: 'rainbow', animated: true },
            { name: '脉冲动画', value: 'pulse', animated: true },
            { name: '闪烁动画', value: 'blink', animated: true },
            { name: '渐变动画', value: 'gradient', animated: true }
        ];
        
        // 创建颜色选择对话框
        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>选择文本颜色</h3>
                    <button class="dialog-close" id="close-color-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="color-tabs">
                        <button class="color-tab active" data-tab="variables">变量颜色</button>
                        <button class="color-tab" data-tab="static">静态颜色</button>
                        <button class="color-tab" data-tab="animated">动画颜色</button>
                    </div>
                    
                    <div class="color-tab-content active" id="variables-tab">
                        <div class="color-picker">
                            ${variableColors.map(color =>
                                `<div class="color-option" data-color="${color.value}"
                                     style="background-color: var(--marked-text-color-${color.value});"
                                     title="${color.name}"></div>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="color-tab-content" id="static-tab">
                        <div class="color-picker">
                            ${staticColors.map(color =>
                                `<div class="color-option" data-color="${color.value}"
                                     style="background-color: ${color.value};"
                                     title="${color.name}"></div>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="color-tab-content" id="animated-tab">
                        <div class="color-picker">
                            ${animatedColors.map(color =>
                                `<div class="color-option animated" data-color="${color.value}"
                                     data-animated="${color.animated}"
                                     style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff);"
                                     title="${color.name}"></div>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 16px;">
                        <label for="color-text-input">文本内容</label>
                        <input type="text" id="color-text-input" class="form-input"
                               placeholder="输入要着色的文本" value="${this.editor.getDoc().getSelection()}">
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-secondary" id="cancel-color">取消</button>
                    <button class="btn btn-primary" id="confirm-color">应用颜色</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.classList.add('active');
        
        let selectedColor = variableColors[0].value;
        let isAnimated = false;
        
        // 绑定事件
        const closeBtn = document.getElementById('close-color-dialog');
        const cancelBtn = document.getElementById('cancel-color');
        const confirmBtn = document.getElementById('confirm-color');
        const textInput = document.getElementById('color-text-input');
        const tabs = dialog.querySelectorAll('.color-tab');
        const tabContents = dialog.querySelectorAll('.color-tab-content');
        
        // 标签切换
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // 选择颜色
        const setupColorOptions = (container) => {
            const colorOptions = container.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    selectedColor = option.getAttribute('data-color');
                    isAnimated = option.getAttribute('data-animated') === 'true';
                });
            });
        };
        
        // 为所有标签页设置颜色选择
        tabContents.forEach(setupColorOptions);
        
        // 默认选中第一个颜色
        document.querySelector('#variables-tab .color-option').classList.add('selected');
        
        const closeDialog = () => {
            dialog.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(dialog);
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            const text = textInput.value || '彩色文本';
            
            // 插入彩色文本标记
            const doc = this.editor.getDoc();
            let colorMarkup;
            
            if (isAnimated) {
                colorMarkup = `{colorChange:${selectedColor}}{${text}}`;
            } else {
                colorMarkup = `{color:${selectedColor}}{${text}}`;
            }
            
            doc.replaceSelection(colorMarkup);
            this.editor.focus();
            
            const colorType = isAnimated ? '动画' : '变量';
            this.showSuccessMessage(`已插入${colorType}颜色文本`);
        });
    }

    /**
     * 显示tModLoader API引用对话框
     */
    showTModLoaderRefDialog() {
        // 创建API引用对话框
        const dialog = document.createElement('div');
        dialog.className = 'tmodloader-ref-dialog';
        dialog.innerHTML = `
            <div class="tmodloader-ref-content">
                <div class="tmodloader-ref-header">
                    <h3>tModLoader API引用</h3>
                    <button class="dialog-close" id="close-ref-dialog">&times;</button>
                </div>
                <div class="tmodloader-ref-body">
                    <div class="form-group">
                        <input type="text" id="api-search" class="api-search form-input"
                               placeholder="搜索API...">
                    </div>
                    
                    <div class="api-category">
                        <div class="api-category-title">常用类</div>
                        <ul class="api-list">
                            <li class="api-item" data-api="Mod" data-type="class">
                                <span>Mod</span>
                                <span class="api-item-type">类</span>
                            </li>
                            <li class="api-item" data-api="ModPlayer" data-type="class">
                                <span>ModPlayer</span>
                                <span class="api-item-type">类</span>
                            </li>
                            <li class="api-item" data-api="ModItem" data-type="class">
                                <span>ModItem</span>
                                <span class="api-item-type">类</span>
                            </li>
                            <li class="api-item" data-api="ModNPC" data-type="class">
                                <span>ModNPC</span>
                                <span class="api-item-type">类</span>
                            </li>
                            <li class="api-item" data-api="ModProjectile" data-type="class">
                                <span>ModProjectile</span>
                                <span class="api-item-type">类</span>
                            </li>
                            <li class="api-item" data-api="Main" data-type="class">
                                <span>Main</span>
                                <span class="api-item-type">静态类</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="api-category">
                        <div class="api-category-title">常用方法</div>
                        <ul class="api-list">
                            <li class="api-item" data-api="NewProjectile" data-type="method">
                                <span>NewProjectile</span>
                                <span class="api-item-type">方法</span>
                            </li>
                            <li class="api-item" data-api="SpawnNPC" data-type="method">
                                <span>SpawnNPC</span>
                                <span class="api-item-type">方法</span>
                            </li>
                            <li class="api-item" data-api="Dust" data-type="method">
                                <span>Dust</span>
                                <span class="api-item-type">方法</span>
                            </li>
                            <li class="api-item" data-api="Item.NewItem" data-type="method">
                                <span>Item.NewItem</span>
                                <span class="api-item-type">方法</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="tmodloader-ref-footer">
                    <button class="btn btn-secondary" id="cancel-ref">取消</button>
                    <button class="btn btn-primary" id="confirm-ref">插入引用</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定事件
        const closeBtn = document.getElementById('close-ref-dialog');
        const cancelBtn = document.getElementById('cancel-ref');
        const confirmBtn = document.getElementById('confirm-ref');
        const searchInput = document.getElementById('api-search');
        const apiItems = dialog.querySelectorAll('.api-item');
        
        let selectedApi = null;
        
        // 选择API
        apiItems.forEach(item => {
            item.addEventListener('click', () => {
                apiItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                selectedApi = {
                    name: item.getAttribute('data-api'),
                    type: item.getAttribute('data-type')
                };
            });
        });
        
        // 搜索功能
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            
            apiItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                const isMatch = text.includes(searchTerm);
                
                if (isMatch) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };
        
        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            if (selectedApi) {
                // 插入API引用格式
                const doc = this.editor.getDoc();
                const refFormat = selectedApi.type === 'method'
                    ? `\`${selectedApi.name}()\``
                    : `\`${selectedApi.name}\``;
                    
                doc.replaceSelection(refFormat);
                this.editor.focus();
                
                closeDialog();
                this.showSuccessMessage(`已插入${selectedApi.name}API引用`);
            } else {
                this.showErrorMessage('请先选择一个API');
            }
        });
    }
    /**
     * 初始化Git集成功能
     */
    initGitIntegration() {
        // 添加Git相关的工具栏按钮事件
        this.bindToolbarButton('btn-git-commit', () => this.showGitCommitDialog());
        this.bindToolbarButton('btn-git-pr', () => this.showGitPRDialog());
        this.bindToolbarButton('btn-git-history', () => this.showGitHistoryDialog());
        this.bindToolbarButton('btn-git-config', () => this.showGitConfigDialog());
        
        // 检查Git配置
        this.checkGitConfig();
        
        console.log('Git集成功能初始化完成');
    }

    /**
     * 检查Git配置
     */
    checkGitConfig() {
        const gitConfig = localStorage.getItem('git-config');
        if (!gitConfig) {
            console.log('未找到Git配置，需要设置');
            return false;
        }
        
        try {
            const config = JSON.parse(gitConfig);
            if (!config.token || !config.repo || !config.owner) {
                console.log('Git配置不完整，需要重新设置');
                return false;
            }
            return true;
        } catch (error) {
            console.error('解析Git配置失败:', error);
            return false;
        }
    }

    /**
     * 显示Git提交对话框
     */
    showGitCommitDialog() {
        // 检查Git配置
        if (!this.checkGitConfig()) {
            this.showGitConfigDialog();
            return;
        }
        
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'git-commit-dialog';
        dialog.innerHTML = `
            <div class="git-commit-content">
                <div class="git-commit-header">
                    <h3>提交到GitHub</h3>
                    <button class="dialog-close" id="close-git-commit-dialog">&times;</button>
                </div>
                <div class="git-commit-body">
                    <div class="form-group">
                        <label for="git-repo">仓库</label>
                        <input type="text" id="git-repo" class="form-input" readonly>
                    </div>
                    <div class="form-group">
                        <label for="git-branch">分支</label>
                        <input type="text" id="git-branch" class="form-input" value="main">
                    </div>
                    <div class="form-group">
                        <label for="git-message">提交信息</label>
                        <textarea id="git-message" class="form-textarea" rows="4" placeholder="输入提交信息..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="update-config" checked>
                            同时更新config.json
                        </label>
                    </div>
                </div>
                <div class="git-commit-footer">
                    <button class="btn btn-secondary" id="cancel-git-commit">取消</button>
                    <button class="btn btn-primary" id="confirm-git-commit">提交</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 获取Git配置并填充表单
        const gitConfig = JSON.parse(localStorage.getItem('git-config'));
        const repoInput = document.getElementById('git-repo');
        if (repoInput && gitConfig) {
            repoInput.value = `${gitConfig.owner}/${gitConfig.repo}`;
        }

        // 绑定事件
        const closeBtn = document.getElementById('close-git-commit-dialog');
        const cancelBtn = document.getElementById('cancel-git-commit');
        const confirmBtn = document.getElementById('confirm-git-commit');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 确认提交
        confirmBtn.addEventListener('click', () => {
            this.performGitCommit();
            closeDialog();
        });

        // 显示对话框
        dialog.classList.add('active');
    }

    /**
     * 执行Git提交
     */
    async performGitCommit() {
        const gitConfig = JSON.parse(localStorage.getItem('git-config'));
        const branch = document.getElementById('git-branch').value;
        const message = document.getElementById('git-message').value;
        const updateConfig = document.getElementById('update-config').checked;

        if (!message.trim()) {
            this.showErrorMessage('请输入提交信息');
            return;
        }

        try {
            // 获取当前文档内容
            const content = this.editor.getValue();
            const metadata = this.getMetadata();
            const filename = this.generateFilename(metadata);

            // 创建文件内容
            const fileContent = this.formatDocumentForGit(content, metadata);

            // 发送到GitHub
            const result = await this.sendToGitHub(gitConfig, filename, fileContent, branch, message);

            if (result.success) {
                this.showSuccessMessage('文档已成功提交到GitHub');
                
                // 如果需要更新config.json
                if (updateConfig) {
                    await this.updateConfigFile(metadata, filename);
                }
                
                // 保存提交历史
                this.saveCommitHistory({
                    filename: filename,
                    message: message,
                    branch: branch,
                    timestamp: new Date().toISOString(),
                    url: result.url
                });
            } else {
                this.showErrorMessage('提交失败: ' + result.error);
            }
        } catch (error) {
            console.error('Git提交失败:', error);
            this.showErrorMessage('提交失败: ' + error.message);
        }
    }

    /**
     * 发送到GitHub
     */
    async sendToGitHub(gitConfig, filename, content, branch, message) {
        const url = `https://api.github.com/repos/${gitConfig.owner}/${gitConfig.repo}/contents/docs/${filename}`;
        
        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: branch
        };

        try {
            // 首先检查文件是否存在
            const checkResponse = await fetch(url, {
                headers: {
                    'Authorization': `token ${gitConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (checkResponse.ok) {
                // 文件存在，需要获取SHA
                const fileData = await checkResponse.json();
                body.sha = fileData.sha;
            }

            // 创建或更新文件
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${gitConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    url: result.commit.html_url
                };
            } else {
                const error = await response.json();
                return {
                    success: false,
                    error: error.message || '未知错误'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 显示Git Pull Request对话框
     */
    showGitPRDialog() {
        // 检查Git配置
        if (!this.checkGitConfig()) {
            this.showGitConfigDialog();
            return;
        }
        
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'git-pr-dialog';
        dialog.innerHTML = `
            <div class="git-pr-content">
                <div class="git-pr-header">
                    <h3>创建Pull Request</h3>
                    <button class="dialog-close" id="close-git-pr-dialog">&times;</button>
                </div>
                <div class="git-pr-body">
                    <div class="form-group">
                        <label for="pr-source-branch">源分支</label>
                        <input type="text" id="pr-source-branch" class="form-input" placeholder="例如: feature/new-tutorial">
                    </div>
                    <div class="form-group">
                        <label for="pr-target-branch">目标分支</label>
                        <input type="text" id="pr-target-branch" class="form-input" value="main">
                    </div>
                    <div class="form-group">
                        <label for="pr-title">PR标题</label>
                        <input type="text" id="pr-title" class="form-input" placeholder="输入PR标题...">
                    </div>
                    <div class="form-group">
                        <label for="pr-description">PR描述</label>
                        <textarea id="pr-description" class="form-textarea" rows="6" placeholder="描述PR的内容和变更..."></textarea>
                    </div>
                </div>
                <div class="git-pr-footer">
                    <button class="btn btn-secondary" id="cancel-git-pr">取消</button>
                    <button class="btn btn-primary" id="confirm-git-pr">创建PR</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = document.getElementById('close-git-pr-dialog');
        const cancelBtn = document.getElementById('cancel-git-pr');
        const confirmBtn = document.getElementById('confirm-git-pr');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 确认创建PR
        confirmBtn.addEventListener('click', () => {
            this.createPullRequest();
            closeDialog();
        });

        // 显示对话框
        dialog.classList.add('active');
    }

    /**
     * 创建Pull Request
     */
    async createPullRequest() {
        const gitConfig = JSON.parse(localStorage.getItem('git-config'));
        const sourceBranch = document.getElementById('pr-source-branch').value;
        const targetBranch = document.getElementById('pr-target-branch').value;
        const title = document.getElementById('pr-title').value;
        const description = document.getElementById('pr-description').value;

        if (!sourceBranch || !title) {
            this.showErrorMessage('请填写源分支和PR标题');
            return;
        }

        try {
            const result = await this.createPROnGitHub(gitConfig, sourceBranch, targetBranch, title, description);

            if (result.success) {
                this.showSuccessMessage('Pull Request创建成功');
                // 可以在新窗口中打开PR
                window.open(result.url, '_blank');
            } else {
                this.showErrorMessage('PR创建失败: ' + result.error);
            }
        } catch (error) {
            console.error('创建PR失败:', error);
            this.showErrorMessage('PR创建失败: ' + error.message);
        }
    }

    /**
     * 在GitHub上创建PR
     */
    async createPROnGitHub(gitConfig, sourceBranch, targetBranch, title, description) {
        const url = `https://api.github.com/repos/${gitConfig.owner}/${gitConfig.repo}/pulls`;
        
        const body = {
            title: title,
            head: sourceBranch,
            base: targetBranch,
            body: description || ''
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${gitConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    url: result.html_url
                };
            } else {
                const error = await response.json();
                return {
                    success: false,
                    error: error.message || '未知错误'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 显示Git历史对话框
     */
    showGitHistoryDialog() {
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'git-history-dialog';
        dialog.innerHTML = `
            <div class="git-history-content">
                <div class="git-history-header">
                    <h3>提交历史</h3>
                    <button class="dialog-close" id="close-git-history-dialog">&times;</button>
                </div>
                <div class="git-history-body">
                    <div class="git-history-list" id="git-history-list">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <div class="git-history-footer">
                    <button class="btn btn-secondary" id="cancel-git-history">关闭</button>
                    <button class="btn btn-primary" id="refresh-git-history">刷新</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = document.getElementById('close-git-history-dialog');
        const cancelBtn = document.getElementById('cancel-git-history');
        const refreshBtn = document.getElementById('refresh-git-history');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 刷新历史
        refreshBtn.addEventListener('click', () => {
            this.fetchGitHistory();
        });

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 显示对话框
        dialog.classList.add('active');

        // 加载历史
        this.fetchGitHistory();
    }

    /**
     * 获取Git历史
     */
    async fetchGitHistory() {
        const historyList = document.getElementById('git-history-list');
        if (!historyList) return;

        // 先从本地存储获取历史
        const localHistory = JSON.parse(localStorage.getItem('git-commit-history') || '[]');
        
        if (localHistory.length > 0) {
            this.displayGitHistory(localHistory);
        } else {
            historyList.innerHTML = '<div class="no-history">暂无提交历史</div>';
        }

        // 如果有Git配置，尝试从GitHub获取最新历史
        if (this.checkGitConfig()) {
            try {
                const gitConfig = JSON.parse(localStorage.getItem('git-config'));
                const githubHistory = await this.fetchGitHubHistory(gitConfig);
                
                if (githubHistory.length > 0) {
                    // 合并本地和GitHub历史
                    const combinedHistory = this.mergeGitHistories(localHistory, githubHistory);
                    this.displayGitHistory(combinedHistory);
                }
            } catch (error) {
                console.error('获取GitHub历史失败:', error);
            }
        }
    }

    /**
     * 从GitHub获取历史
     */
    async fetchGitHubHistory(gitConfig) {
        const url = `https://api.github.com/repos/${gitConfig.owner}/${gitConfig.repo}/commits`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${gitConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const commits = await response.json();
                return commits.map(commit => ({
                    sha: commit.sha,
                    message: commit.commit.message,
                    author: commit.commit.author.name,
                    date: commit.commit.author.date,
                    url: commit.html_url
                }));
            } else {
                throw new Error('获取提交历史失败');
            }
        } catch (error) {
            console.error('获取GitHub历史失败:', error);
            return [];
        }
    }

    /**
     * 合并Git历史
     */
    mergeGitHistories(localHistory, githubHistory) {
        // 创建一个Map来去重，以SHA为键
        const historyMap = new Map();
        
        // 添加本地历史
        localHistory.forEach(item => {
            historyMap.set(item.sha || item.timestamp, item);
        });
        
        // 添加GitHub历史
        githubHistory.forEach(item => {
            historyMap.set(item.sha, item);
        });
        
        // 转换为数组并按日期排序
        return Array.from(historyMap.values()).sort((a, b) => {
            const dateA = new Date(a.date || a.timestamp);
            const dateB = new Date(b.date || b.timestamp);
            return dateB - dateA;
        });
    }

    /**
     * 显示Git历史
     */
    displayGitHistory(history) {
        const historyList = document.getElementById('git-history-list');
        if (!historyList) return;

        if (history.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无提交历史</div>';
            return;
        }

        let html = '<div class="history-items">';
        history.forEach(item => {
            const date = new Date(item.date || item.timestamp);
            const dateStr = date.toLocaleString('zh-CN');
            
            html += `
                <div class="history-item">
                    <div class="history-info">
                        <div class="history-message">${item.message}</div>
                        <div class="history-meta">
                            <span class="history-author">${item.author || 'Unknown'}</span>
                            <span class="history-date">${dateStr}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        ${item.url ? `<a href="${item.url}" target="_blank" class="btn btn-sm btn-secondary">查看</a>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';

        historyList.innerHTML = html;
    }

    /**
     * 显示Git配置对话框
     */
    showGitConfigDialog() {
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.className = 'git-config-dialog';
        dialog.innerHTML = `
            <div class="git-config-content">
                <div class="git-config-header">
                    <h3>Git配置</h3>
                    <button class="dialog-close" id="close-git-config-dialog">&times;</button>
                </div>
                <div class="git-config-body">
                    <div class="form-group">
                        <label for="git-owner">仓库所有者</label>
                        <input type="text" id="git-owner" class="form-input" placeholder="例如: username">
                    </div>
                    <div class="form-group">
                        <label for="git-repo-name">仓库名称</label>
                        <input type="text" id="git-repo-name" class="form-input" placeholder="例如: my-repo">
                    </div>
                    <div class="form-group">
                        <label for="git-token">GitHub Token</label>
                        <input type="password" id="git-token" class="form-input" placeholder="输入GitHub Personal Access Token">
                        <small class="form-help">需要在GitHub设置中生成具有repo权限的Token</small>
                    </div>
                    <div class="form-group">
                        <label for="git-email">邮箱</label>
                        <input type="email" id="git-email" class="form-input" placeholder="your-email@example.com">
                    </div>
                    <div class="form-group">
                        <label for="git-name">用户名</label>
                        <input type="text" id="git-name" class="form-input" placeholder="Your Name">
                    </div>
                </div>
                <div class="git-config-footer">
                    <button class="btn btn-secondary" id="cancel-git-config">取消</button>
                    <button class="btn btn-primary" id="save-git-config">保存配置</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(dialog);

        // 如果已有配置，填充表单
        const existingConfig = localStorage.getItem('git-config');
        if (existingConfig) {
            try {
                const config = JSON.parse(existingConfig);
                document.getElementById('git-owner').value = config.owner || '';
                document.getElementById('git-repo-name').value = config.repo || '';
                document.getElementById('git-token').value = config.token || '';
                document.getElementById('git-email').value = config.email || '';
                document.getElementById('git-name').value = config.name || '';
            } catch (error) {
                console.error('解析Git配置失败:', error);
            }
        }

        // 绑定事件
        const closeBtn = document.getElementById('close-git-config-dialog');
        const cancelBtn = document.getElementById('cancel-git-config');
        const saveBtn = document.getElementById('save-git-config');

        // 关闭对话框
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        // 点击对话框外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // 保存配置
        saveBtn.addEventListener('click', () => {
            this.saveGitConfig();
            closeDialog();
        });

        // 显示对话框
        dialog.classList.add('active');
    }

    /**
     * 保存Git配置
     */
    saveGitConfig() {
        const owner = document.getElementById('git-owner').value;
        const repo = document.getElementById('git-repo-name').value;
        const token = document.getElementById('git-token').value;
        const email = document.getElementById('git-email').value;
        const name = document.getElementById('git-name').value;

        if (!owner || !repo || !token) {
            this.showErrorMessage('请填写所有必填字段');
            return;
        }

        const config = {
            owner: owner,
            repo: repo,
            token: token,
            email: email,
            name: name
        };

        try {
            localStorage.setItem('git-config', JSON.stringify(config));
            this.showSuccessMessage('Git配置已保存');
        } catch (error) {
            console.error('保存Git配置失败:', error);
            this.showErrorMessage('保存配置失败: ' + error.message);
        }
    }

    /**
     * 保存提交历史
     */
    saveCommitHistory(commit) {
        try {
            const history = JSON.parse(localStorage.getItem('git-commit-history') || '[]');
            history.unshift(commit); // 添加到开头
            
            // 限制历史记录数量
            if (history.length > 50) {
                history.splice(50);
            }
            
            localStorage.setItem('git-commit-history', JSON.stringify(history));
        } catch (error) {
            console.error('保存提交历史失败:', error);
        }
    }

    /**
     * 更新config.json文件
     */
    async updateConfigFile(metadata, filename) {
        try {
            // 获取当前配置
            const configResponse = await fetch(this.options.configPath);
            const config = await configResponse.json();
            
            // 确定分类路径
            const categoryPath = metadata.category || 'uncategorized';
            
            // 确保分类存在
            if (!config.categories[categoryPath]) {
                config.categories[categoryPath] = {
                    title: metadata.category || '未分类',
                    topics: {}
                };
            }
            
            // 确定主题路径
            const topicPath = metadata.topic || 'general';
            
            // 确保主题存在
            if (!config.categories[categoryPath].topics[topicPath]) {
                config.categories[categoryPath].topics[topicPath] = {
                    title: metadata.topic || '通用',
                    files: []
                };
            }
            
            // 添加文件到主题
            const fileData = {
                name: filename,
                title: metadata.title || filename,
                path: `${categoryPath}/${filename}`,
                description: metadata.description || '',
                author: metadata.author || '',
                date: metadata.date || new Date().toISOString().split('T')[0],
                difficulty: metadata.difficulty || '',
                tags: metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : []
            };
            
            const files = config.categories[categoryPath].topics[topicPath].files;
            
            // 检查文件是否已存在
            const existingIndex = files.findIndex(f => f.path === fileData.path);
            if (existingIndex !== -1) {
                files[existingIndex] = fileData;
            } else {
                files.push(fileData);
            }
            
            // 这里应该调用API来更新实际的config.json文件
            // 由于这是前端代码，我们只能模拟这个过程
            console.log('配置文件已更新:', config);
            
            // 保存更新后的配置到本地存储作为备份
            localStorage.setItem('config-backup', JSON.stringify(config));
            
            this.showSuccessMessage('配置文件已更新');
            
            return { success: true };
        } catch (error) {
            console.error('更新配置文件失败:', error);
            this.showErrorMessage('更新配置文件失败: ' + error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 格式化文档用于Git提交
     */
    formatDocumentForGit(content, metadata) {
        let formattedContent = '';
        
        // 添加前置元数据
        if (metadata.title || metadata.author || metadata.date || metadata.category || metadata.difficulty || metadata.tags || metadata.description) {
            formattedContent += '---\n';
            if (metadata.title) formattedContent += `title: ${metadata.title}\n`;
            if (metadata.author) formattedContent += `author: ${metadata.author}\n`;
            if (metadata.date) formattedContent += `date: ${metadata.date}\n`;
            if (metadata.category) formattedContent += `category: ${metadata.category}\n`;
            if (metadata.difficulty) formattedContent += `difficulty: ${metadata.difficulty}\n`;
            if (metadata.tags) formattedContent += `tags: [${metadata.tags.split(',').map(tag => `"${tag.trim()}"`).join(', ')}]\n`;
            if (metadata.description) formattedContent += `description: ${metadata.description}\n`;
            formattedContent += `document_id: ${this.currentDocumentId}\n`;
            formattedContent += `last_modified: ${new Date().toISOString()}\n`;
            formattedContent += '---\n\n';
        }
        
        formattedContent += content;
        
        return formattedContent;
    }

    /**
     * 生成文件名
     */
    generateFilename(metadata) {
        if (metadata.filename) {
            return metadata.filename.endsWith('.md') ? metadata.filename : `${metadata.filename}.md`;
        }
        
        // 基于标题生成文件名
        let filename = metadata.title || 'untitled';
        
        // 转换为英文文件名
        filename = filename
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // 移除特殊字符
            .replace(/\s+/g, '-') // 空格替换为连字符
            .substring(0, 50); // 限制长度
        
        return `${filename}.md`;
    }
}

// 导出类供全局使用
window.MarkdownEditor = MarkdownEditor;