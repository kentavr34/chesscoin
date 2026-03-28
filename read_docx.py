import zipfile
import xml.etree.ElementTree as ET
import sys

def extract_text_from_docx(file_path):
    try:
        doc = zipfile.ZipFile(file_path)
        content = doc.read('word/document.xml')
        tree = ET.fromstring(content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text = []
        for p in tree.iterfind('.//w:p', namespaces):
            para_text = []
            for t in p.iterfind('.//w:t', namespaces):
                if t.text:
                    para_text.append(t.text)
            text.append(''.join(para_text))
        return '\n'.join(text)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    with open('output.txt', 'w', encoding='utf-8') as f:
        f.write(extract_text_from_docx('c:/Users/SAM/Desktop/chesscoin/Шахматы.docx'))
    print("Extracted to output.txt")
