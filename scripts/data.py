#!/usr/bin/env python3
import lxml.html
import json
import urllib.request
import re
from pathlib import Path

def main():
    classes = ["Assault", "Bulwark", "Vanguard", "Tactical", "Heavy", "Sniper"]

    for class_name in classes:
        resource_path = Path(f"resources/{class_name}")
        resource_path.mkdir(parents=True, exist_ok=True)

        data = gen_json(class_name)

        data_path = Path(f"data")
        data_path.mkdir(parents=True, exist_ok=True)

        output_file = data_path / f"{class_name.lower()}.json"
        with open(output_file, "w") as f:
            json.dump(data, f, indent=2)

def gen_json(class_name):
    class_id = class_name.lower()
    wiki_url = f"https://spacemarine2.fandom.com/api.php?action=parse&format=json&page={class_name}&formatversion=2"

    data_dict = {"id":class_id,"name":class_name,"icon":f"resources/{class_name}/{class_id}classicon.webp","sections":[{"id":"core","name":"CORE","columns":[{"id":"core-col-1","name":"COMBAT","perks":[]},{"id":"core-col-2","name":"TACTICS","perks":[]},{"id":"core-col-3","name":"MASTERY","perks":[]}]},{"id":"team","name":"TEAM","columns":[{"id":"team-col-1","name":"SQUAD","perks":[]}]},{"id":"gear","name":"GEAR","columns":[{"id":"gear-col-1","name":"PRIMARY","perks":[]},{"id":"gear-col-2","name":"SECONDARY","perks":[]},{"id":"gear-col-3","name":"EQUIPMENT","perks":[]}]},{"id":"signature","name":"SIGNATURE","columns":[{"id":"signature-col-1","name":"ABILITY","perks":[]}]}], "prestige": []}

    column_lookup = {}
    for section in data_dict['sections']:
        for column in section['columns']:
            column_lookup[column['id']] = column['perks']

    with urllib.request.urlopen(wiki_url) as url:
        data = json.loads(url.read().decode())
        html = data['parse']['text']
        root = lxml.html.fromstring(html)
        perk_table = root.xpath('.//table[contains(@class, "perktree-table")]')[0]
        perk_rows = perk_table.xpath('.//tr')
        perk_header_row = perk_rows[0]
        perk_headers = []

        perk_header_cells = perk_header_row.xpath('.//th')
        for cell in perk_header_cells:
            colspan = int(cell.get('colspan', 1))
            perk_header = cell.text_content().strip()

            perk_header_count = 0
            for _ in range(colspan):
                perk_header_count += 1
                perk_header_text = f"{perk_header.lower()}-col-{perk_header_count}"
                perk_headers.append(perk_header_text)

        for perk_row in perk_rows[1:]:
            perk_td_count = 0
            perk_tds = perk_row.xpath('.//td')
            for perk_td in perk_tds:
                perk_header = perk_headers[perk_td_count]
                perk_td_count += 1
                perk = {}
                perk_name = perk_td.text_content().strip()
                perk["name"] = perk_name
                perk_img_src = perk_td.xpath('.//img/@data-src')
                if perk_img_src:
                    perk_img = re.sub(r'/revision.*', '', perk_img_src[0])
                    perk_img = re.sub(r'.*/', '', perk_img)
                    perk["img"] = f"resources/{class_name}/{perk_img}"
                    img_file = Path(perk["img"])
                    if not img_file.exists():
                        urllib.request.urlretrieve(perk_img_src[0], img_file)
                    perk_id = re.sub(r'Perk[_]*', '', perk_img)
                    perk_id = re.sub(r'_', '-', perk_id)
                    perk_id = re.sub(r'.png$', '', perk_id)
                    perk["id"] = perk_id
                title = perk_td.xpath('.//*[@title]/@title')[0]
                parts = title.split('\n\n')
                if len(parts) >= 2:
                    description = parts[0].strip()
                    perk["desc"] = description
                column_lookup[perk_header].append(perk)

        prestige_table = root.xpath('.//table[contains(@class, "perklist-table")]')[1]
        prestige_rows = prestige_table.xpath('.//tr')
        for prestige_row in prestige_rows[1:]:
            prestige = {}
            prestige_td_count = 0
            prestige_tds = prestige_row.xpath('.//td')
            for prestige_td in prestige_tds:
                content = prestige_td.text_content().strip()
                if content.isnumeric():
                    continue
                if prestige_td_count == 0:
                    prestige_td_count += 1
                    prestige["name"] = content
                    prestige_img_src = prestige_td.xpath('.//img/@data-src')
                    if prestige_img_src:
                        prestige_img = re.sub(r'/revision.*', '', prestige_img_src[0])
                        prestige_img = re.sub(r'.*/', '', prestige_img)
                        prestige["img"] = f"resources/{class_name}/{prestige_img}"
                        img_file = Path(prestige["img"])
                        if not img_file.exists():
                            urllib.request.urlretrieve(prestige_img_src[0], img_file)
                        prestige_id = re.sub(r'Prestige_perk_', '', prestige_img)
                        prestige_id = re.sub(r'_', '-', prestige_id)
                        prestige_id = re.sub(r'.png$', '', prestige_id)
                        prestige["id"] = prestige_id
                else:
                    prestige["desc"] = content

            data_dict["prestige"].append(prestige)

    return(data_dict)

if __name__ == "__main__":
    main()