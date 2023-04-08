import os
import json

def convert_name(name: str):
    return name.split('.')[0]

if __name__ == '__main__':
    files = os.listdir('./dataset')
    with open('original_graph_list.json', "w", encoding='utf-8-sig') as f:
        files = list(map(convert_name, files))
        json.dump(files, f, ensure_ascii=False)