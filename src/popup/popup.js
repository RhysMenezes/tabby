var tabs_list = document.querySelector("#tabs-list");

// Function for stripping HTML
function stripHTML(str) {
    var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;"
    };
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Add event listeners
document.addEventListener("DOMContentLoaded", addTabs);
document.addEventListener("DOMContentLoaded", extendTabsList);
document.addEventListener("dblclick", documentDblClicked);
document.addEventListener("click", documentClicked);
document.querySelector("#search").addEventListener("keyup", searchTextChanged);
browser.runtime.onMessage.addListener(
    function (request, sender, sendResponse){
        switch (request.msg) {
            case "ACTIVE_TAB_CHANGED":
                setActiveTab(request.details.windowId, request.details.tabId);
                break;
            case "TAB_FAV_ICON_CHANGED":
                getFavIconFromTabEntry(findTabEntryById(request.details.tabId)).src = request.details.favIconUrl;
                break;
            case "TAB_PINNED_STATUS_CHANGED":
                let tabEntry = findTabEntryById(request.details.tabId);
                let pinBtnImage = tabEntry.querySelector(".tab-entry-pin-btn img");
                let windowEntryList = tabEntry.parentElement;
                let pinnedTabs;
                console.log(request.details.pinned);
                if (request.details.pinned) {
                    pinnedTabs = windowEntryList.querySelectorAll(".pinned-tab");
                    tabEntry.classList.add("pinned-tab");
                    pinBtnImage.src = "../icons/pinremove.svg";
                } else {
                    pinnedTabs = windowEntryList.querySelectorAll(".pinned-tab");
                    tabEntry.classList.remove("pinned-tab");
                    pinBtnImage.src = "../icons/pin.svg";
                }
                let lastPinnedTab = pinnedTabs[pinnedTabs.length-1];
                if (lastPinnedTab !== undefined) {
                    windowEntryList.insertBefore(tabEntry, lastPinnedTab.nextSibling);
                } else {
                    windowEntryList.insertBefore(tabEntry, windowEntryList.children[0]);
                }
                break;
            case "TAB_TITLE_CHANGED":
                findTabEntryById(request.details.tabId).querySelector("span:not(.tab-details)").textContent = request.details.title;
                break;
            case "TAB_REMOVED":
                removeTab(request.details.tabId, request.details.windowId);
                break;
        }
    }
);

// Set tabs list height to any available height
function extendTabsList() {
    let searchArea = document.querySelector("#search-area");
    let searchAreaHeight = getActualHeight(searchArea);
    let tabs = document.querySelector("#tabs");
    tabs.style.height = "calc(100% - " + searchAreaHeight + "px)";
}

// Get actual height of an element
function getActualHeight(element) {
    var styles = window.getComputedStyle(element);
    var margin = parseFloat(styles['marginTop']) +
               parseFloat(styles['marginBottom']);
    return element.offsetHeight + margin;
}

// Get favicon from a tab entry
function getFavIconFromTabEntry(entry) {
    return entry.querySelector("img");
}

// Find tab entry by tab id
function findTabEntryById(tabId) {
    return document.querySelector(".tab-entry[data-tab_id=\"" + tabId + "\"]");
}

// Find window entry by tab id
function findWindowEntryById(windowId) {
    return tabs_list.querySelector("li[data-window_id=\"" + windowId + "\"]");
}

// Get all windows
function getWindows() {
    return browser.windows.getAll({
        populate: true,
        windowTypes: ["normal", "popup", "devtools"]
    });
}

// Get current window
function getCurrentWindow() {
    return browser.tabs.query({currentWindow: true});
}

// Find tab entry inside a window entry
function findTabEntryInWindow(windowEntry, tabId) {
    return windowEntry.querySelector("li[data-tab_id=\"" + tabId + "\"]");
}

// Get active tab in the specified window
function getActiveTab(windowId) {
    let window = findWindowEntryById(windowId);
    return window.querySelector(".current-tab");
}

// Set active tab in the specified window
function setActiveTab(windowId, tabId) {
    let window = findWindowEntryById(windowId);
    let tab = findTabEntryInWindow(window, tabId);
    getActiveTab(windowId).classList.remove("current-tab");
    tab.classList.add("current-tab");
}

// Remove tab
function removeTab(tabId, windowId) {
    let tabEntry = findTabEntryById(tabId);
    tabEntry.outerHTML = "";
    browser.tabs.remove(tabId);
    browser.windows.get(windowId, {
        populate: true
    }).then(function (window){
        for (let tab of window.tabs) {
            if (tab.active) {
                findTabEntryById(tab.id).classList.add("current-tab");
                break;
            }
        }
    });
}

// Update tabs
function updateTabs(windows) {
    tabs_list.innerHTML = "";
    let windowEntry;
    let currentWindowEntry;
    for (let i = 0; i < windows.length; i++) {
        let w = windows[i];
        windowEntry = document.createElement("li");
        windowEntry.classList.add("window-entry");
        windowEntry.classList.add("category");
        windowEntry.setAttribute("data-window_id", w.id);
        let span = document.createElement("span");
        span.textContent += "Window " + (i+1);
        if (w.focused) {
            currentWindowEntry = windowEntry;
            windowEntry.classList.add("current-window");
            span.textContent += " - Current";
        }
        if (w.incognito) {
            windowEntry.classList.add("incognito-window")
            span.textContent += " (Incognito)";
        }
        span.classList.add("darker-button");
        windowEntry.appendChild(span);
        windowEntry.addEventListener("dragstart", windowEntryDragStarted);
        windowEntry.addEventListener("dragover", windowEntryDraggingOver);
        windowEntry.addEventListener("drop", windowEntryDropped);
        let tabs_list_html = document.createElement("ul");
        tabs_list_html.classList.add("category-list");
        for (let tab of w.tabs) {
            if (tab.id !== browser.tabs.TAB_ID_NONE) {
                let tabEntry = document.createElement("li");
                tabEntry.classList.add("tab-entry");
                tabEntry.classList.add("button");
                tabEntry.setAttribute("draggable", "true");

                let favicon = null;
                span = document.createElement("span");
                span.classList.add("tab-title");
                span.textContent += stripHTML(tab.title);

                let details = document.createElement("span");
                details.classList.add("tab-details");
                if (tab.active) {
                    tabEntry.classList.add("current-tab");
                }
                if (tab.favIconUrl) {
                    favicon = document.createElement("img");
                    favicon.src = tab.favIconUrl;
                }

                let closeBtn = document.createElement("span");
                closeBtn.classList.add("inline-button");
                closeBtn.classList.add("red-button");
                closeBtn.classList.add("img-button");
                closeBtn.classList.add("tab-entry-remove-btn");
                let closeBtnImage = document.createElement("img");
                closeBtnImage.src = "../icons/close.svg";
                closeBtnImage.style.height = "100%";
                closeBtn.appendChild(closeBtnImage);

                let pinBtn = document.createElement("span");
                pinBtn.classList.add("inline-button");
                pinBtn.classList.add("red-button");
                pinBtn.classList.add("img-button");
                pinBtn.classList.add("tab-entry-pin-btn");
                let pinBtnImage = document.createElement("img");
                pinBtnImage.src = "../icons/pin.svg";
                pinBtnImage.style.height = "100%";
                pinBtn.appendChild(pinBtnImage);

                let buttons = document.createElement("span");
                buttons.classList.add("tab-entry-buttons");
                buttons.appendChild(pinBtn);
                buttons.appendChild(closeBtn);

                tabEntry.setAttribute("data-tab_id", tab.id);
                tabEntry.appendChild(buttons);
                if (favicon !== null) {
                    tabEntry.appendChild(favicon);
                }
                tabEntry.appendChild(span);

                if (tab.pinned) {
                    pinBtnImage.src = "../icons/pinremove.svg";
                    tabEntry.classList.add("pinned-tab");
                    let pinnedTabs = tabs_list_html.querySelectorAll(".pinned-tab");
                    let lastPinnedTab = pinnedTabs[pinnedTabs.length-1];
                    if (lastPinnedTab !== undefined) {
                        tabs_list_html.insertBefore(tabEntry, lastPinnedTab.nextSibling);
                    } else {
                        tabs_list_html.insertBefore(tabEntry, tabs_list_html.children[0]);
                    }
                } else {
                    tabs_list_html.appendChild(tabEntry);
                }
            }
        }
        windowEntry.appendChild(tabs_list_html);
        tabs_list.appendChild(windowEntry);
    }
    document.querySelector("#tabs").style.display = "block";
    currentWindowEntry.scrollIntoView({ behavior: 'smooth' });
}

// Add tabs to list
function addTabs() {
    getWindows().then(function (windows) {
        updateTabs(windows);
    });
}

// Search
function searchTextChanged(e) {
    let input, filter, tabEntries;
    input = document.querySelector("#search");
    filter = input.value.toUpperCase();
    tabEntries = document.querySelectorAll(".tab-entry");
    if (filter !== "") {
        for (let tabEntry of tabEntries) {
            if (!tabEntry.querySelector(".tab-title").textContent.toUpperCase().includes(filter)) {
                tabEntry.style.display = "none";
            } else {
                tabEntry.style.display = "block";
            }
        }
    } else {
        for (let tabEntry of tabEntries) {
            tabEntry.style.display = "block";
        }
    }
}

function documentDblClicked(e) {
    if (e.button === 0) {
        if (e.target.classList.contains("tab-entry")) {
            let tabId = parseInt(e.target.getAttribute("data-tab_id"));
            let parentWindowId = parseInt(e.target.parentElement.parentElement.getAttribute("data-window_id"));
            browser.tabs.update(tabId, {
                active: true
            });
            browser.windows.get(parentWindowId, {
                populate: true
            }).then(function (w){
                getCurrentWindow().then(function (cw) {
                    if (w !== cw) {
                        browser.windows.update(w.id, {
                            focused: true
                        });
                    }
                });
            });
        } else if (e.target.parentElement.classList.contains("window-entry")) {
            let windowId = parseInt(e.target.parentElement.getAttribute("data-window_id"));
            browser.windows.update(windowId, {
                focused: true
            });
            window.close();
        }
    }
    e.preventDefault();
}

function documentClicked(e) {
    if (e.button === 0) {
        if (e.target.classList.contains("tab-entry")) {
            let tabId = parseInt(e.target.getAttribute("data-tab_id"));
            browser.tabs.captureTab(tabId).then(function (imageUri){
                let detailsImage = document.querySelector("#details-img");
                detailsImage.src = imageUri;
                let detailsTitle = document.querySelector("#details-title");
                let detailsURL = document.querySelector("#details-url");
                browser.tabs.get(tabId).then(function (tab) {
                    detailsTitle.textContent = tab.title;
                    detailsURL.textContent = tab.url;
                    document.querySelector("#details-placeholder").style.display = "none";
                    document.querySelector("#tab-details").style.display = "inline-block";
                    document.querySelector("#tab-details").setAttribute("data-tab_id", tabId);
                    if (tab.pinned) {
                        document.querySelector("#details-pinned").style.display = "inline";
                    } else {
                        document.querySelector("#details-pinned").style.display = "none";
                    }
                    if (tab.hidden) {
                        document.querySelector("#details-hidden").style.display = "inline";
                    } else {
                        document.querySelector("#details-hidden").style.display = "none";
                    }
                    if (tab.pinned && tab.hidden) {
                        document.querySelector("#details-comma").style.display = "inline";
                    } else {
                        document.querySelector("#details-comma").style.display = "none";
                    }
                });
            });
        } else if (e.target.id === "details-close") {
            document.querySelector("#details-placeholder").style.display = "inline-block";
            document.querySelector("#tab-details").style.display = "none";
            browser.tabs.remove(parseInt(document.querySelector("#tab-details").getAttribute("data-tab_id")));
        } else if (e.target.classList.contains("tab-entry-remove-btn")) {
            let tabId = e.target.parentElement.parentElement.getAttribute("data-tab_id");
            let tabDetails = document.querySelector("#tab-details");
            if (tabDetails.getAttribute("data-tab_id") === tabId) {
                tabDetails.style.display = "none";
                document.querySelector("#details-placeholder").style.display = "inline-block";
            }
            let parentWindowId = parseInt(e.target.parentElement.parentElement.parentElement.getAttribute("data-window_id"));
            removeTab(parseInt(tabId), parentWindowId);
        } else if (e.target.classList.contains("tab-entry-pin-btn")) {
            let tabId = e.target.parentElement.parentElement.getAttribute("data-tab_id");
            browser.tabs.get(parseInt(tabId)).then(function (tab){
                if (tab.pinned) {
                    browser.tabs.update(parseInt(tabId), {
                        pinned: false
                    });
                } else {
                    browser.tabs.update(parseInt(tabId), {
                        pinned: true
                    });
                }
            });
        }
    }
}

var sourceTab;
var sourceWindow;

function windowEntryDragStarted(e) {
    if (e.target.classList.contains("tab-entry")) {
        sourceTab = e.target;
        sourceWindow = sourceTab.parentElement.parentElement;
        e.dataTransfer.setData("text/plain", sourceTab.outerHTML);
        e.dataTransfer.effectAllowed = "move";
    }
}

function windowEntryDraggingOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (sourceTab !== e.target && e.target.classList.contains("tab-entry")) {
        let lastCursor = e.target.parentElement.querySelector(".insert-cursor");
        if (lastCursor !== null) {
            lastCursor.outerHTML = "";
        }
        let cursor = document.createElement("div");
        cursor.classList.add("insert-cursor");
        e.target.parentElement.insertBefore(cursor, e.target);
    }
}

function windowEntryDropped(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.classList.contains("tab-entry")) {
        let newTabEntry = sourceTab.cloneNode(true);
        sourceTab.outerHTML = "";
        let cursors = tabs_list.querySelectorAll(".insert-cursor");
        for (let cursor of cursors) {
            cursor.outerHTML = "";
        }
        e.target.parentElement.insertBefore(newTabEntry, e.target);
        let destinationWindowId = e.target.parentElement.parentElement.getAttribute("data-window_id");
        if (destinationWindowId !== null) {
            browser.tabs.move(parseInt(newTabEntry.getAttribute("data-tab_id")), {
                windowId: parseInt(destinationWindowId),
                index: Array.prototype.indexOf.call(newTabEntry.parentElement.childNodes, newTabEntry)
            });
        } else {
            browser.tabs.move(parseInt(newTabEntry.getAttribute("data-tab_id")), {
                index: Array.prototype.indexOf.call(newTabEntry.parentElement.childNodes, newTabEntry)
            });
        }
    }
}
