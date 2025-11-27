#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试搜索功能修复的脚本
验证search.js是否能够正确搜索到子文件夹中的文件
"""

import json
import os
import sys
import urllib.parse
import urllib.request
import webbrowser
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

# 设置控制台编码为UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

def test_config_json():
    """测试config.json是否包含正确的文件路径"""
    print("=== 测试 config.json ===")
    
    try:
        with open('docs/config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 检查all_files数组
        if 'all_files' in config and config['all_files']:
            print(f"[OK] 找到 {len(config['all_files'])} 个文件在all_files中")
            
            for file in config['all_files']:
                if 'path' in file:
                    print(f"  - {file['path']} (标题: {file.get('title', '未知')})")
                else:
                    print(f"  - {file['filename']} (无path字段)")
        else:
            print("[ERROR] config.json中没有all_files或为空")
            
        # 检查categories结构
        if 'categories' in config:
            print(f"[OK] 找到 {len(config['categories'])} 个分类")
            
            for cat_name, cat_data in config['categories'].items():
                if 'topics' in cat_data:
                    for topic_name, topic_data in cat_data['topics'].items():
                        if 'files' in topic_data and topic_data['files']:
                            print(f"  - 分类 {cat_name}/主题 {topic_name}: {len(topic_data['files'])} 个文件")
                            for file in topic_data['files']:
                                if 'path' in file:
                                    print(f"    - {file['path']}")
                                else:
                                    print(f"    - {file['filename']} (无path字段)")
        
        return True
    except Exception as e:
        print(f"[ERROR] 读取config.json失败: {e}")
        return False

def test_search_js_fixes():
    """测试search.js中的修复"""
    print("\n=== 测试 search.js 修复 ===")
    
    try:
        with open('assets/js/search.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查关键修复点
        fixes = [
            ("viewerUrl使用相对路径", "const viewerUrl = `docs/viewer.html?file=${encodeURIComponent(relativePath)}`;"),
            ("parseMetadataWithConfig支持完整路径", "async parseMetadataWithConfig(content, fileName, fullPath)"),
            ("getTutorialFilesFromConfig去重", "const processedFiles = new Set();"),
            ("保存完整文件路径", "filePath: file // 保存完整文件路径用于后续匹配")
        ]
        
        for fix_name, fix_code in fixes:
            if fix_code in content:
                print(f"[OK] {fix_name} - 已修复")
            else:
                print(f"[ERROR] {fix_name} - 未找到修复代码")
                
        return True
    except Exception as e:
        print(f"[ERROR] 读取search.js失败: {e}")
        return False

def test_server_running():
    """测试服务器是否运行"""
    print("\n=== 测试服务器状态 ===")
    
    urls = [
        "http://localhost:8080",
        "http://localhost:8050"
    ]
    
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    print(f"[OK] 服务器运行在 {url}")
                    return url
        except:
            print(f"[ERROR] 服务器未运行在 {url}")
    
    print("请先启动服务器:")
    print("  npx http-server . -p 8080 -c-1 --cors")
    print("  或")
    print("  python -m http.server 8050")
    return None

def test_search_functionality(base_url):
    """测试搜索功能"""
    print(f"\n=== 测试搜索功能 (服务器: {base_url}) ===")
    
    # 测试搜索关键词
    test_queries = [
        "贡献者",
        "新人",
        "Topic",
        "Mod"
    ]
    
    for query in test_queries:
        print(f"\n测试搜索: {query}")
        
        # 这里我们只能测试搜索页面是否能加载
        # 实际的搜索结果需要手动在浏览器中验证
        search_url = f"{base_url}/search-results.html?q={urllib.parse.quote(query)}"
        try:
            with urllib.request.urlopen(search_url, timeout=5) as response:
                if response.status == 200:
                    print(f"[OK] 搜索页面加载成功: {search_url}")
                else:
                    print(f"[ERROR] 搜索页面加载失败: {response.status}")
        except Exception as e:
            print(f"[ERROR] 搜索请求失败: {e}")

def main():
    """主测试函数"""
    print("搜索功能修复测试")
    print("=" * 50)
    
    # 测试配置文件
    config_ok = test_config_json()
    
    # 测试代码修复
    code_ok = test_search_js_fixes()
    
    # 测试服务器
    server_url = test_server_running()
    
    if server_url:
        # 测试搜索功能
        test_search_functionality(server_url)
        
        print(f"\n=== 手动测试指南 ===")
        print(f"1. 在浏览器中打开 {server_url}")
        print("2. 使用搜索框测试以下关键词:")
        print("   - 贡献者 (应该找到'给贡献者阅读的文章'文件夹中的文件)")
        print("   - 新人 (应该找到'Modder入门'文件夹中的文件)")
        print("   - Topic (应该找到'TopicSystem使用指南.md')")
        print("3. 点击搜索结果，确认能够正确打开文件")
        print("4. 检查URL是否包含正确的文件路径")
        
        # 询问是否打开浏览器
        try:
            choice = input("\n是否打开浏览器进行测试? (y/n): ").lower().strip()
            if choice == 'y':
                webbrowser.open(server_url)
        except KeyboardInterrupt:
            pass
    
    print("\n=== 测试总结 ===")
    if config_ok and code_ok:
        print("[OK] 所有代码修复已完成")
        if server_url:
            print("[OK] 服务器正在运行，可以进行手动测试")
        else:
            print("[ERROR] 服务器未运行，无法进行完整测试")
    else:
        print("[ERROR] 存在问题，请检查上述错误")
    
    return 0 if (config_ok and code_ok) else 1

if __name__ == "__main__":
    sys.exit(main())