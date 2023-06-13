
let pageArray = {{ pageKeywords| safe}}

//////////////////////////////////////// search
class Document {
    constructor(page, item) {
      this.page = page;
      this.item = item;
      let text = item.title+" "+item.excerpt;

      this.id = page.page+"#"+item.id;
      this.tf = {};
      this.words = text.toLowerCase().split(' ');
      this.words.forEach(word => {
        this.tf[word] = (this.tf[word] || 0) + 1;
      });
    }
  
    partialMatchScore(queryWord) {
      return this.words.reduce((score, word) => {
        for (let i = 0; i < word.length; i++) {
          if (word.startsWith(queryWord, i)) {
            return score + queryWord.length / word.length;
          }
        }
        return score;
      }, 0);
    }
  }
  
  class Corpus {
    constructor(documents) {
      this.documents = documents;
      this.idf = {};
  
      const allWords = this.documents.flatMap(doc => Object.keys(doc.tf));
      const uniqueWords = [...new Set(allWords)];
  
      uniqueWords.forEach(word => {
        const docsWithWord = this.documents.filter(doc => doc.tf[word]);
        this.idf[word] = Math.log(this.documents.length / docsWithWord.length);
      });
    }
  
    tfidf(query) {
      const queryWords = query.toLowerCase().split(' ');
      const scores = this.documents.map(doc => {
        let score = 0;
        queryWords.forEach(word => {
          const tf = doc.tf[word] || 0;
          const idf = this.idf[word] || 0;
          const partialMatchScore = doc.partialMatchScore(word);
          score += tf * idf + partialMatchScore;
        });
        return { id: doc.id, score: score, doc: doc };
      });
  
      // Sort by score in descending order and return IDs and scores
      return scores.sort((a, b) => b.score - a.score);
    }
  }
  
/////////////
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
    const documents = [];
    pageArray.forEach((page)=>{
        page.excerpts.forEach((excerpt)=>{
            documents.push(
            new Document(page,excerpt)
            )
        });
    });
    
    const corpus = new Corpus(documents);
    return corpus.tfidf(searchString);
}

function clearSearch(){
    let searchResults = document.querySelector("#searchResults");

    while (searchResults.firstChild) {
        searchResults.removeChild(searchResults.lastChild);
    }
}

function search() {
    let searchResults = document.querySelector("#searchResults");
    let seachKeywords = txtSearch.value;
    if(seachKeywords=='') {
        clearSearch();
        searchResults.innerHTML=
        `<a class="panel-block">
            <div class="content">
                <div  class="has-text-grey search-item is-size-7 pt-1 pb-2">No results were found</div>
            </div>					
        </a>`;
        return;
    }

    let results = sortPagesByTokens(seachKeywords, pageArray);
    //console.log(pages);

    clearSearch();
    let filteredResults = results.filter((e)=>e.score>0);
    filteredResults.forEach((result) => {
        let doc = result.doc;
        let page = doc.page;
        let item = doc.item;

        var wrapper = document.createElement('div');
        let title = "";
        let description = "";

        if(item.id){
            title=`<div  class="is-size-6 has-text-weight-semibold">${page.title}</div>
            <div  class="is-size-7 has-text-weight-semibold has-text-grey pl-1">Section: ${item.title}</div>
            `
            description = item.excerpt;
        }else{
            title = `<div  class="is-size-6 has-text-weight-semibold">${item.title}</div>` ;
            description =item.excerpt;
        }

        wrapper.innerHTML =
            `<a class="panel-block is-active" data-url="${result.id}">
						<div class="content">
                            <div  class="is-size-6 has-text-weight-semibold">${title}</div>
							<div  class="has-text-grey search-item is-size-7 pt-1 pb-2">${description}</div>
						</div>					
			</a>`;
            wrapper.querySelector('a').onclick = function () {
            //console.log(this.dataset);
            goto(this.dataset.url);
        };
        wrapper.focus();
        searchResults.appendChild(wrapper.querySelector('a'));

    });
    if (filteredResults.length == 0) {
        ts = `<div  class="has-text-grey pt-5 pb-5 pl-4">No results were found</div>`;
        searchResults.innerHTML = ts;
    }

    searchResults.dispatchEvent(new Event('change'));

}

function goto(url) {
    hideSearchDialog();
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

document.addEventListener('DOMContentLoaded', (event) => {
    document.querySelectorAll('.code-block code').forEach((el) => {
      hljs.highlightElement(el);
    });
    document.getElementById('loading').style.display = 'none';
});

window.addEventListener('beforeunload', function (e) {
    document.getElementById('loading').style.display = 'block';
});

