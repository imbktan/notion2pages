let richTextToHTML = (rts)=>{
    let ret = '';
    rts.forEach(element => {
        let value = '';
        if(element.text.link){
            value=`<a href='${element.text.link.url}'>${element.text.content}</a>`
        }else{
            value=element.text.content;
        }
        if(element.annotations){
            if(element.annotations.bold) value=`<b>${value}</b>`;
            if(element.annotations.italic) value=`<i>${value}</i>`;
            if(element.annotations.underline) value=`<u>${value}</u>`;
            if(element.annotations.strikethrough) value=`<s>${value}</s>`;
            if(element.annotations.code) value=`<span class='inline-code'>${value}</span>`;
        }
        ret+=value;
    });
    return ret;
}

let convertChildren = async(block, notion, level)=>{
    let ret ='';
    if(block.has_children){
        const list = await notion.blocks.children.list({
            block_id: block.id
        });
        //console.log('----------');
        //console.log(JSON.stringify(list,null,2));
        //console.log('----------');
        ret+=await convertNotionBlocksToHTML(list.results, notion, level);

    }
    return ret;
}


let convertNotionBlocksToHTML = async(blocks, notion, level = 0 )=>{
    let html = '';
    //console.log(JSON.stringify(blocks,null,2));

    let getSibling = (index, t)=>{
        if(index<0 || index>=blocks.length) return null;
        if(blocks[index].type!=t) return null;
        return blocks[index];
    }

    for(let i=0;i<blocks.length;i++){
        let block = blocks[i];
        try{
            let cls = `lvl${level}`
            if(block.type=='heading_1' || block.type=='heading_2' || block.type=='heading_3' ){
                let value = richTextToHTML(block[block.type]['rich_text']);
                let n = block.type.substr(block.type.length-1,1);
                html+=`<h${n} class="${cls}">${value}</h${n}>`;
            }else if(block.type=='paragraph'){
                let value = richTextToHTML(block[block.type]['rich_text']);
                let childrenContent = await convertChildren(block, notion, level+1);
                html+=`<p class="${cls}">${value}${childrenContent}</p>`;
            }else if(block.type=='image'){
                let url = '';
                let alt = '';
                let rt_caption = '';
                if(block[block.type].type=='external')
                    url = block[block.type]['external']['url'];
                else if(block[block.type].type=='file')
                    url = block[block.type]['file']['url'];
                
                let captions = block[block.type]['caption'];
                if(captions && captions.length>0){
                    alt = captions.map((e)=>e.plain_text).join("");
                    rt_caption = richTextToHTML(captions)
                }
                
                html+=`<img src='${url}'  class="${cls}" ${alt!=''?'alt="'+alt+'"':''}/>`;
                if(rt_caption!=null){
                    html+=`<div class='image-caption'>${rt_caption}</div>`;
                }
            }else if(block.type=='video'){
                let url = '';
                if(block[block.type].type=='external')
                    url = block[block.type]['external']['url'];
                else if(block[block.type].type=='file')
                    url = block[block.type]['file']['url'];
                
                if(url.indexOf("youtube.com")>=0){
                    html+=`
                    <div class="youtube-video-container">
                        <iframe width="560" height="315" src="${url}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                    </div>
                    `;
                }
                
            }else if(block.type=='bulleted_list_item' || block.type=='numbered_list_item'){
                let t = 'ul';
                if(block.type=='numbered_list_item') t='ol';

                let value = richTextToHTML(block[block.type]['rich_text']);
                let childrenContent = await convertChildren(block, notion, level+1);
                let st= '', et = '';

                if(getSibling(i-1,block.type)==null) st+=`<${t} class="${cls}">`;
                if(getSibling(i+1,block.type)==null) et = `</${t}>`;

                html+=`${st}<li>${value}${childrenContent}</li>${et}`;
            }else if(block.type=='quote'){
                let value = richTextToHTML(block[block.type]['rich_text']);
                html+=`<blockquote class="${cls}">${value}</blockquote>`;
            }else if(block.type=='code'){
                let value = richTextToHTML(block[block.type]['rich_text']);
                html+=`<pre class="code-block ${cls}"><code class="language-${block[block.type]['language']}">${value}</code></pre>`;
            }else if(block.type=='divider'){
                html+=`<hr>`;
            }else if(block.type=='bookmark'){
                let url = block[block.type]['url'];
                html+=`<a href='${url}'><a>`;                
            }else if(block.type=='table' && block.has_children){
                let tableContent=`<table  class="${cls}">`;
                tableContent+=await convertChildren(block, notion, level+1);
                tableContent+='</table>';
                html+=tableContent;               
            }else if(block.type=='table_row'){
                let tds= '';
                block[block.type]['cells'].forEach((cell)=>{
                    let value = richTextToHTML(cell);
                    tds+=`<td>${value}</td>`;
                });
                html+=`<tr>${tds}</tr>`
            }
        }catch(ex){
            console.log(ex);
            console.log(JSON.stringify(block,null,2));
            break;
        }
    }
    return html;
}

exports.convertNotionBlocksToHTML = convertNotionBlocksToHTML ;