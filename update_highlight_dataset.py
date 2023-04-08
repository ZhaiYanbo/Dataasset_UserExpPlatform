"""
该python脚本在dataset/highlight文件夹中增加或删除文件时使用，运行该脚本后在当前目录下生成
一个名为highlight_list.json的文件，辅助浏览器获取文件名
"""

import os
import json

if __name__ == '__main__':
    files = os.listdir('./dataset/highlight')
    files = list(map(lambda file_name: file_name.split('.')[0], files))
    with open('highlight_list.json', 'w', encoding='utf-8-sig') as f:
        json.dump(files, f, ensure_ascii=False)