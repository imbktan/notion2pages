const { Client } = require("@notionhq/client");
const {convertNotionBlocksToHTML} = require('./notion-to-html');

const fs = require('fs');
const nunjucks = require('nunjucks');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const https = require('https');
const path = require('path');
const url = require('url');
const { Settings } = require(process.argv[2]);

const axios = require('axios');
const { pipeline } = require('stream/promises');

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

const convertToSlug = (str) =>{
    str = str.replace(/^\s+|\s+$/g, ''); // Trim leading/trailing white spaces
    str = str.toLowerCase(); // Convert to lowercase
    str = str.replace(/[^\w\s-]/g, ''); // Remove non-word characters (excluding spaces and hyphens)
    str = str.replace(/\s+/g, '-'); // Replace spaces with hyphens
    str = str.replace(/--+/g, '-'); // Replace multiple consecutive hyphens with a single hyphen
    return str;
}

const savePageJSON =async(block, slug, results)=>{
    if(Settings.ouputPageJSON===true){
        let jsonPath = `./${Settings.buildDirectory}/json`
        if (!fs.existsSync(jsonPath)) {
            fs.mkdirSync(jsonPath);
        } 
        let content = JSON.stringify(results,null,2);
        await fs.promises.writeFile(`${jsonPath}/${block.id}-${slug}.json`, content);
    }
}

const exportPageBlockToHTML = async (block, slug) => {
    for(let i=0;i<3;i++){//retry
        try{
            let block_id = block.id;
            let results = [];
            let next_cursor = null;
            while(true){
                let p={
                    block_id: block_id,
                    page_size: 5000
                }
                if(next_cursor!=null) p['start_cursor'] = next_cursor;
                let resp= await notion.blocks.children.list(p);
                 results = results.concat(resp.results);
                 if(resp.has_more){
                    next_cursor = resp.next_cursor;
                    console.log(`next_cursor: ${next_cursor}`);
                 }else{
                    break;
                 }
            }


            let content = await convertNotionBlocksToHTML(results, notion);
            await savePageJSON(block, slug, results);
            return {
                content: content,
                block: block
            }
        }catch(ex){
            console.log(ex);
        }
        await sleep(1000);
    }
}

const downloadFile = async (url, destinationPath) => {
    try {
        const response = await axios.get(url, { responseType: 'stream' });
        await pipeline(response.data, fs.createWriteStream(destinationPath));
    } catch (error) {
        console.error(`Error downloading image: ${url} `, error.message);
    }
};

const getValue = (r, name, defaultValue) => {
    try {
        let p = r.properties[name];
        if (p.type == 'checkbox') {
            return p[p.type];
        }else if (p.type == 'select') {
            let val = p[p.type].name;
            return val;
        } else {
            let val = p[p.type][0].plain_text;
            return val;
        }

    } catch (ex) {
        //console.log(ex);
        return defaultValue;
    }
}

const buildPagesFromDatabase = async (database_obj, page, order) => {

    const resp = await notion.databases.query({
        database_id: database_obj.id,
        sorts: [
          {
            property: 'order',
            direction: 'ascending',
          },
        ],
      });

    
    if(database_obj.child_database.title.indexOf("section::")==0){
        const title = database_obj.child_database.title.split("section::")[1].trim();

        console.log(`Section: ${title}`)
        let new_database_page = {
            id: database_obj.id,
            type: 'database',
            title: title,
            pages: [],
            order: order
        }
        page.pages.push(new_database_page);

        let blocksToProcessed = [];

        for (let i = 0; i < resp.results.length; i++) {
            let r = resp.results[i];
            let is_published = true;
            if (getValue(r, "is_published", true) === false) {
                is_published = false;
            }
            
            if (is_published) {
                let slug = getValue(r, "slug", "") || getValue(r, "Slug", "") || convertToSlug(title);   
                console.log(`Exporting ${slug} ...`);
                blocksToProcessed.push(exportPageBlockToHTML(r,slug));           
            }
        }

        let rets = await Promise.all(blocksToProcessed);
        console.log(`Done exporting notion blocks: ${title}`);
        for(let r=0;r<rets.length;r++){
            let ret = rets[r];
            let content = ret.content;
            let in_menu = true;
            let order = 1000;

            let title = getValue(ret.block, "Name", "");
            let slug = getValue(ret.block, "slug", "") || getValue(r, "Slug", "") || convertToSlug(title); 
            if (getValue(ret.block, "in_menu", true) === false) {
                in_menu = false;
            }

            order = 1000+ parseInt(getValue(ret.block, "sort", 0));

            let new_page = {
                id: ret.block_id,
                type: 'page',
                title: title,
                slug: slug,
                content: content,
                in_menu: in_menu,
                pages: [],
                order: order
            }
            new_database_page.pages.push(new_page)
            await findDatabaseInPage(ret.block.id, new_page);
        };

    }
}

const findDatabaseInPage = async (page_id, page) => {
    for(let i=0;i<3;i++){
        try{
            if (page == null) {
                page = {
                    id: page_id,
                    type: 'root',
                    pages: []
                };
            }
            const response = await notion.blocks.children.list({ block_id: page_id, });
            let dbs = [];
            for (let d = 0; d < response.results.length; d++) {
                let db = response.results[d];
                if (db.type == 'child_database') {
                    dbs.push(buildPagesFromDatabase(db, page,d));
                }
            }
            let rets = await Promise.all(dbs);
            page.pages.sort(function(a,b){
                return a.order - b.order;
            });
            return page;
        }catch(ex){
            console.log(ex);
        }
        await sleep(1000);
    }
}


const preprocessContent = async (page) => {
    const dom = new JSDOM(page.content);
    if (Settings.downloadImages) {
        let imagesToBeProcessed = [];
        let imgs = dom.window.document.querySelectorAll("img");
        for (let ig = 0; ig < imgs.length; ig++) {
            let img = imgs[ig];
            let img_url = img.src;
            const filename = path.basename(new URL(img_url).pathname);
            const pathname = url.parse(img.src).pathname;
            const parts = pathname.split('/');
            const id = parts[parts.length - 2];

            let alt = img.getAttribute('alt');
            let new_image_path = '';
            let new_url = '';
            let nfp = `${id}-${filename}`;

            if(alt!=null && alt!=''){
                nfp = page.slug+"-"+convertToSlug(alt)+path.extname(filename);
            }

            new_image_path = `${Settings.buildDirectory}/images/${nfp}`;
            new_url = `images/${nfp}`;

            img.src = new_url;
            imagesToBeProcessed.push(downloadFile(img_url, './' + new_image_path));
            console.log(`Exporting image: ./${new_image_path} ...`);
        }
        await Promise.all(imagesToBeProcessed);
    }


    let headings = dom.window.document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    let headingsText = null;
    headings.forEach((heading) => {
        heading.id = convertToSlug(heading.textContent);
    });

    if (headings.length > 0)
        headingsText = Array.from(headings).map((e) => e.textContent).join("|");

    page.keywords = headingsText;
    page.processedContent = dom.serialize();
    //page.excerpt = getExcerpt(dom);
    page.excerpts = extractHeadings(page,dom);
}

const getExcerpt = (dom)=>{
    let ps = dom.window.document.querySelectorAll("p");
    let content = "";

    for(let i=0;i<ps.length && i<3;i++){
        content+=ps[i].textContent;
    }

    return content.substring(0,300);
}

let extractHeadings = (page, dom)=>{
    let headings = dom.window.document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    let excerpts = [{
        id: "",
        tagName: "",
        title: page.title,
        excerpt: getExcerpt(dom)
    }];
    excerpts.push();
    headings.forEach((heading) => {
        let excerpt = '';
        let current = heading.nextSibling;
        while(current){
            if(current.tagName=="P") excerpt+=current.textContent;
            else if(current.tagName && current.tagName.indexOf("H")==0) break;
            current = current.nextSibling;
        }
        excerpts.push({
            id: heading.id,
            tagName: heading.tagName,
            title: heading.textContent,
            excerpt: excerpt//.substring(0,150)
        })
    });
    return excerpts;
}

const processPage = async (page, parent) => {

    if (page.type == 'page') {
        await preprocessContent(page);

        let rendered = nunjucks.render(Settings.templateHTML, {
            html: page.processedContent,
            title: page.title,
            slug: page.slug,
            rootPage: rootPage, //
            links: Settings.links,
            iconURL: Settings.iconURL,
            websiteURL: Settings.websiteURL,
            footer: Settings.footer
        });

        let pageFileName = `${page.slug}.html`;
        pages.push(pageFileName);
        console.log(`Writing page ${pageFileName} ...`)
        await fs.promises.writeFile(`./${Settings.buildDirectory}/${pageFileName}`, rendered);
        pageKeywords.push({
            page: pageFileName,
            title: page.title,
            keywords: page.keywords,
            order: page.order,
            parentOrder: parent==null?0:parent.order,
            in_menu: page.in_menu,
            excerpt: page.excerpt,
            excerpts: page.excerpts
        })
    }
    let pagesToBeProcessed = [];
    for (let p = 0; p < page.pages.length; p++) {
        let cpage = page.pages[p];
        pagesToBeProcessed.push(processPage(cpage, page))
    }
    await Promise.all(pagesToBeProcessed);
}


let pageKeywords = [];
let rootPage = null;
let pages = [];

const notion = new Client({
    auth: Settings.apiKey,
});


(async () => {
    console.log('Processing Notion blocks ...');
    nunjucks.configure({ autoescape: true });
    rootPage = await findDatabaseInPage(Settings.pageID, null)
    await processPage(rootPage,null)

    console.log('Processing script.js');
    pageKeywords.sort(function(a,b){
        return (a.parentOrder*10000+a.order) - (b.parentOrder*10000+b.order);
    });
    let rendered_script = nunjucks.render(Settings.templateScript, { pageKeywords: JSON.stringify(pageKeywords.filter((e)=>e.in_menu==true)) });
    await fs.promises.writeFile(`./${Settings.buildDirectory}/script.js`, rendered_script);


    console.log('Processing sitemap.xml');
    const now = new Date();
    const last_modified = now.toISOString();
    let rendered_sitemap = nunjucks.render(Settings.templateSiteMap, { 
        pages: pages.map((e)=>{
            return {
                url: Settings.sitemapBaseURL+"/"+ e,
                last_modified: last_modified
            }
        })
    });
    await fs.promises.writeFile(`./${Settings.buildDirectory}/sitemap.xml`, rendered_sitemap);

})();