const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
var showdown = require('showdown');
const fs = require('fs');
const nunjucks = require('nunjucks');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const https = require('https');
const path = require('path');
const url = require('url');
const { Settings } = require(process.argv[2]);


const convertToSlug = (str) =>{
    str = str.replace(/^\s+|\s+$/g, ''); // Trim leading/trailing white spaces
    str = str.toLowerCase(); // Convert to lowercase
    str = str.replace(/[^\w\s-]/g, ''); // Remove non-word characters (excluding spaces and hyphens)
    str = str.replace(/\s+/g, '-'); // Replace spaces with hyphens
    str = str.replace(/--+/g, '-'); // Replace multiple consecutive hyphens with a single hyphen
    return str;
}

const exportPageBlockToHTML = async (block_id) => {
    const { results } = await notion.blocks.children.list({ block_id, });
    //convert to markdown
    const mdblocks = await n2m.blocksToMarkdown(results.filter((e) => e.type != 'child_database'));
    const mdString = n2m.toMarkdownString(mdblocks);

    var converter = new showdown.Converter({ tables: true, completeHTMLDocument: false });

    let text = mdString.parent;
    let content = converter.makeHtml(text);

    return {
        content: content
    }
}

const downloadFile = (url, destinationPath) => {
    https.get(url, (response) => {
        const fileStream = fs.createWriteStream(destinationPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
        });
    }).on('error', (err) => {
        console.error(`Error downloading image: ${url} `, err.message);
    });
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

const buildPagesFromDatabase = async (database_obj, page) => {
    const resp = await notion.databases.query({ database_id: database_obj.id, });
    console.log(`Section: ${database_obj.child_database.title}`)
    let new_database_page = {
        id: database_obj.id,
        type: 'database',
        title: database_obj.child_database.title,
        pages: []
    }
    page.pages.push(new_database_page);
    for (let i = 0; i < resp.results.length; i++) {
        let r = resp.results[i];
        let title = getValue(r, "Name", "");
        let slug = getValue(r, "slug", "") || getValue(r, "Slug", "") || convertToSlug(title);
        let is_published = true;
        let in_menu = true;

        if (getValue(r, "is_published", true) === false) {
            is_published = false;
        }
        
        if (getValue(r, "in_menu", true) === false) {
            in_menu = false;
        }
        
        if (is_published) {
            console.log(`Exporting ${slug} ...`);
            let ret = await exportPageBlockToHTML(r.id)
            let content = ret.content;
            let new_page = {
                id: r.id,
                type: 'page',
                title: title,
                slug: slug,
                content: content,
                in_menu: in_menu,
                pages: []
            }
            new_database_page.pages.push(new_page)
            await findDatabaseInPage(r.id, new_page);
        }
    }
    new_database_page.valid_pages = new_database_page.pages.filter((e)=>e.in_menu==true).length>0;
}

const findDatabaseInPage = async (page_id, page) => {
    if (page == null) {
        page = {
            id: page_id,
            type: 'root',
            pages: []
        };
    }
    const response = await notion.blocks.children.list({ block_id: page_id, });

    for (let d = 0; d < response.results.length; d++) {
        let db = response.results[d];
        if (db.type == 'child_database') {
            await buildPagesFromDatabase(db, page);
        }
    }
    return page;
}

const preprocessContent = async (page) => {
    const dom = new JSDOM(page.content);
    if (Settings.downloadImages) {
        let imgs = dom.window.document.querySelectorAll("img");
        for (let ig = 0; ig < imgs.length; ig++) {
            let img = imgs[ig];
            let img_url = img.src;
            const filename = path.basename(new URL(img_url).pathname);
            const pathname = url.parse(img.src).pathname;
            const parts = pathname.split('/');
            const id = parts[parts.length - 2];
            let np = `${Settings.buildDirectory}/images/${id}-${filename}`;
            let nurl = `images/${id}-${filename}`;
            img.src = nurl;
            downloadFile(img_url, './' + np);
            console.log(`Exporting image: ./${np} ...`);
        }
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
}

const processPage = async (page) => {

    if (page.type == 'page') {
        await preprocessContent(page);

        let rendered = nunjucks.render(Settings.templateHTML, {
            html: page.processedContent,
            title: page.title,
            slug: page.slug,
            root_page: root_page, //
            links: Settings.links,
            iconURL: Settings.iconURL,
            websiteURL: Settings.websiteURL

        });

        let pageFileName = `${page.slug}.html`;
        console.log(`Writing page ${pageFileName} ...`)
        await fs.promises.writeFile(`./${Settings.buildDirectory}/${pageFileName}`, rendered);
        pageKeywords.push({
            page: pageFileName,
            title: page.title,
            keywords: page.keywords
        })
    }
    for (let p = 0; p < page.pages.length; p++) {
        let cpage = page.pages[p];
        await processPage(cpage);
    }
}


let pageKeywords = [];
let root_page = null;

const notion = new Client({
    auth: Settings.apiKey,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
    nunjucks.configure({ autoescape: true });
    root_page = await findDatabaseInPage(Settings.pageID, null)
    await processPage(root_page)

    let rendered_script = nunjucks.render(Settings.templateScript, { pageKeywords: JSON.stringify(pageKeywords) });
    await fs.promises.writeFile(`./${Settings.buildDirectory}/script.js`, rendered_script);

})();