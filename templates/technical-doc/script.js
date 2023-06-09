
let pageArray = {{ pageKeywords| safe}}

let searchDialog = document.querySelector('#searchDialog');
let txtSearch = document.querySelector('#txtSearch');

function hideSearchDialog() {
    searchDialog.classList.remove('is-active');
}

function showSearchDialog() {
    searchDialog.classList.add('is-active');
    txtSearch.focus();
    search();
}

window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        hideSearchDialog();
    }

    const isMac = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
    if (ctrlKey && event.keyCode == 75) {
        event.preventDefault();
        showSearchDialog();
    }
});

function sortPagesByTokens(searchString, pageArray) {
    // Split the searchString into tokens
    const searchTokens = searchString.toLowerCase().split(/\s+/);

    // Create a function to calculate the 'score' of a page
    function calculateScore(page) {
        let score = 0;

        // Split the title and keywords into tokens
        const titleTokens = page.title.toLowerCase().split(/\s+/);
        const keywordTokens = (page.keywords || "").toLowerCase().split('|').join(' ').split(/\s+/);

        // For each searchToken, increase score for each occurrence in title and keywords
        for (let token of searchTokens) {
            score += titleTokens.filter(titleToken => titleToken === token).length;
            score += keywordTokens.filter(keywordToken => keywordToken === token).length;
            if(token.length>=3){
                score += titleTokens.filter(titleToken => titleToken.indexOf(token)>=0).length;
                score += keywordTokens.filter(keywordToken => keywordToken.indexOf(token)>=0).length;
            }
        }
        return score;
    }
    pageArray.forEach((page) => { page.score = calculateScore(page) });
    // Sort the pages by their score
    pageArray.sort((page1, page2) => page2.score - page1.score);

    return pageArray.filter((p) => p.score > 0);
}


function search() {
    //console.log(txtSearch.value);

    let pages = sortPagesByTokens(txtSearch.value, pageArray);
    //console.log(pages);
    let searchResults = document.querySelector("#searchResults");

    while (searchResults.firstChild) {
        searchResults.removeChild(searchResults.lastChild);
    }
    pages.forEach((page) => {
        var item = document.createElement('div');
        item.innerHTML =
            `<a class="panel-block is-active" data-url="${page.page}">
						<div class="content">
							${page.title}
							<!--div  class="has-text-grey">${page.keywords}</div-->
						</div>					
			</a>`;
        item.querySelector('a').onclick = function () {
            //console.log(this.dataset);
            goto(this.dataset.url);
        };
        item.focus();
        searchResults.appendChild(item.querySelector('a'));

    });
    if (pages.length == 0) {
        ts = `<div  class="has-text-grey pt-5 pb-5 pl-4">No results were found</div>`;
        searchResults.innerHTML = ts;
    }

    searchResults.dispatchEvent(new Event('change'));

}

function goto(url) {
    window.location.href = url;
}

////////////////////////////////////////
// Get all the headers in the markdown body
var headers = document.querySelectorAll(".markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6");

var menu = document.querySelector(".table-of-contents");

// A helper function to create a list item for a heading
function createListItem(header) {
    var listItem = document.createElement("li");
    listItem.className = header.tagName.toLowerCase(); // Set class to tag name (h1, h2, etc.)

    // Create a hyperlink element
    var link = document.createElement("a");
    link.href = "#" + header.id;
    link.textContent = header.textContent;

    // Add a click event listener to the link
    /*
    link.addEventListener("click", function (event) {
        event.preventDefault();
        header.scrollIntoView({ behavior: "smooth" });
    });
    */

    // Add the hyperlink to the list item
    listItem.appendChild(link);

    return listItem;
}

// Create the hierarchical structure
var currentList = document.createElement("ul");
menu.appendChild(currentList);

for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    currentList.appendChild(createListItem(header));
}
///////////////////////////
document.addEventListener('DOMContentLoaded', (event) => {
    const menuGroups = document.querySelectorAll('.menu-group');
    const activeItem = document.querySelector('.menu-item.is-active');

    // Collapse all menu groups initially
    menuGroups.forEach(group => group.classList.remove('is-active'));

    // If there's an active item, expand its parent groups
    if (activeItem) {
        let parent = activeItem.parentElement;
        while (parent) {
            if (parent.classList.contains('menu-group')) {
                parent.classList.add('is-active');
            }
            parent = parent.parentElement;
        }
    }

    // Attach event listener to menu group titles for click events
    menuGroups.forEach(group => {
        const title = group.querySelector('.menu-group-title');
        title.addEventListener('click', () => {
            group.classList.toggle('is-active');
        });
    });
});