"""
用于随机生成一些数据表的guid列表，测试高亮功能
"""

import json
import random

if __name__ == '__main__':
    file_name = 'DevSecOps运维案例1'
    with open(f'./dataset/{file_name}.json', 'r', encoding='utf-8-sig') as f:
        nodes = json.load(f)['nodes']
        high_light_nodes = []
        print()
        for node in nodes:
            if node['typeName'] == 'dli.Table' and random.random() < 0.3:
                high_light_nodes.append(node['guid'])

        # 将随机出来的表的guid写入文件中
        with open(f'{file_name}_2.json', 'w', encoding='utf-8-sig') as rf:
            json.dump(high_light_nodes, rf, ensure_ascii=False)
