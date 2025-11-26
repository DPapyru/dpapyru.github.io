// generate-index.js - 自动生成教程索引的脚本
const fs = require('fs');
const path = require('path');

// 读取所有Markdown文件
const docsDir = './docs';
const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md') && file !== 'tutorial-index.md');

// 按类别分组
const categories = {
    'getting-started': [],
    'basic-concepts': [],
    'mod-development': [],
    'advanced-topics': [],
    'resources': []
};

// 解析每个文件的元数据
files.forEach(file => {
    const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
    const metadata = parseMetadata(content);
    
    if (metadata.category) {
        // 检查分类是否存在，如果不存在则创建或使用默认分类
        let targetCategory = metadata.category;
        
        // 如果分类不在预定义列表中，尝试映射或使用默认分类
        if (!categories[targetCategory]) {
            // 尝试将中文分类映射到英文分类键
            const categoryMapping = {
                '入门': 'getting-started',
                '基础概念': 'basic-concepts',
                'Mod开发': 'mod-development',
                '高级主题': 'advanced-topics',
                '资源参考': 'resources'
            };
            
            targetCategory = categoryMapping[metadata.category] || 'resources';
            
            // 如果映射后仍不存在，确保resources分类存在
            if (!categories[targetCategory]) {
                categories[targetCategory] = [];
            }
        }
        
        categories[targetCategory].push({
            file,
            ...metadata
        });
    } else {
        // 如果没有指定类别，默认为resources
        if (!categories.resources) {
            categories.resources = [];
        }
        categories.resources.push({
            file,
            ...metadata
        });
    }
});

// 生成索引内容
let indexContent = `# 教程索引\n\n`;
indexContent += `这个文件是泰拉瑞亚Mod制作教程的索引，列出了所有可用的教程资源。索引是自动生成的，贡献者可以通过添加新的教程文件来更新此索引。\n\n`;
indexContent += `## 如何添加新教程\n\n`;
indexContent += `1. 在\`docs\`目录下创建新的Markdown文件\n`;
indexContent += `2. 在文件开头添加以下元数据格式：\n\n`;
indexContent += `\`\`\`markdown\n---\ntitle: 教程标题\ndifficulty: beginner|intermediate|advanced\ncategory: getting-started|basic-concepts|mod-development|advanced-topics|resources\ntime: 预计完成时间（分钟）\nauthor: 作者名称\ndate: 更新日期（YYYY-MM-DD）\ndescription: 简短描述\n---\n\`\`\`\n\n`;
indexContent += `3. 运行\`node generate-index.js\`脚本自动更新此索引文件\n\n`;

// 按类别生成内容
Object.keys(categories).forEach(category => {
    if (categories[category] && categories[category].length > 0) {
        const categoryTitle = getCategoryTitle(category);
        indexContent += `## ${categoryTitle}\n\n`;
        
        categories[category].sort((a, b) => {
            // 安全地比较标题，处理可能缺失的标题
            const titleA = a.title || '';
            const titleB = b.title || '';
            return titleA.localeCompare(titleB);
        });
        
        categories[category].forEach(tutorial => {
            indexContent += `### [${tutorial.title || '无标题'}](${tutorial.file})\n`;
            indexContent += `- **难度**: ${getDifficultyText(tutorial.difficulty)}\n`;
            // 检查时间字段是否已经包含"分钟"，避免重复
            const timeText = tutorial.time || '未知';
            const timeDisplay = timeText.includes('分钟') ? timeText : `${timeText}分钟`;
            indexContent += `- **预计时间**: ${timeDisplay}\n`;
            indexContent += `- **作者**: ${tutorial.author || '未知'}\n`;
            indexContent += `- **更新日期**: ${tutorial.date || tutorial.last_updated || '未知'}\n`;
            indexContent += `- **描述**: ${tutorial.description || '无描述'}\n\n`;
        });
    }
});

// 添加自动生成脚本部分
indexContent += `---\n\n`;
indexContent += `## 自动生成脚本\n\n`;
indexContent += `为了方便贡献者，我们提供了一个Node.js脚本来自动生成教程索引：\n\n`;
indexContent += `\`\`\`javascript\n// generate-index.js\nconst fs = require('fs');\nconst path = require('path');\n\n// 读取所有Markdown文件\nconst docsDir = './docs';\nconst files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md') && file !== 'tutorial-index.md');\n\n// 按类别分组\nconst categories = {\n    'getting-started': [],\n    'basic-concepts': [],\n    'mod-development': [],\n    'advanced-topics': [],\n    'resources': []\n};\n\n// 解析每个文件的元数据\nfiles.forEach(file => {\n    const content = fs.readFileSync(path.join(docsDir, file), 'utf8');\n    const metadata = parseMetadata(content);\n    \n    if (metadata.category) {\n        categories[metadata.category].push({\n            file,\n            ...metadata\n        });\n    }\n});\n\n// 生成索引内容\nlet indexContent = \`# 教程索引\\\\n\\\\n\`;\n// ... 其余脚本内容\n\`\`\`\n\n`;
indexContent += `要使用此脚本，请运行：\n\n`;
indexContent += `\`\`\`bash\nnode generate-index.js\n\`\`\`\n\n`;
indexContent += `这将自动扫描\`docs\`目录中的所有Markdown文件，解析它们的元数据，并更新\`tutorial-index.md\`文件。\n`;

// 写入索引文件
fs.writeFileSync(path.join(docsDir, 'tutorial-index.md'), indexContent);
console.log('教程索引已更新！');

// 辅助函数
function parseMetadata(content) {
    try {
        // 移除可能的BOM字符
        content = content.replace(/^\uFEFF/, '');
        
        // 尝试多种正则表达式模式
        let metadataMatch = content.match(/---\r?\n(.*?)\r?\n---/s);
        if (!metadataMatch) {
            metadataMatch = content.match(/^---\s*\n(.*?)\n---/ms);
        }
        if (!metadataMatch) {
            return {};
        }
        
        const metadata = {};
        const lines = metadataMatch[1].split(/\r?\n/);
        
        lines.forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                metadata[key] = value;
            }
        });
        
        return metadata;
    } catch (error) {
        console.error('解析元数据时出错:', error.message);
        return {};
    }
}

function getCategoryTitle(category) {
    const titles = {
        'getting-started': '入门指南',
        'basic-concepts': '基础概念',
        'mod-development': 'Mod开发',
        'advanced-topics': '高级主题',
        'resources': '资源参考',
        // 直接支持中文分类名称
        '入门': '入门指南',
        '基础概念': '基础概念',
        'Mod开发': 'Mod开发',
        '高级主题': '高级主题',
        '资源参考': '资源参考'
    };
    return titles[category] || category;
}

function getDifficultyText(difficulty) {
    const texts = {
        'beginner': '初级',
        'intermediate': '中级',
        'advanced': '高级'
    };
    return texts[difficulty] || difficulty;
}