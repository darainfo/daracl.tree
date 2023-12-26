import { Options } from "@t/Options";
import { ConfigInfo } from "@t/ConfigInfo";
import utils from "./util/utils";
import treeEvent from "./event/initEvents";
import { Message } from "@t/Message";
import Lanauage from "./util/Lanauage";
import domUtils from "./util/domUtils";
import { TreeNode } from "@t/TreeNode";
import Checkbox from "./plugins/Checkbox";
import { CHECK_STATE } from "./constants";
import TreeNodeInfo from "./TreeNodeInfo";
import nodeUtils from "./util/nodeUtils";
import Dnd from "./plugins/Dnd";
import Keydown from "./plugins/Keydown";
import Ajax from "./plugins/Ajax";

const defaultOptions = {
  style: {
    width: "",
    height: "",
    paddingLeft: 12,
  },
  rootNode: {
    id: "",
    text: "Root",
  },
  enableRootNode: false,
  itemKey: {
    id: "id",
    pid: "pid",
    text: "text",
    icon: "icon",
  },
  plugins: {
    keydown: {},
  },
  enableIcon: true,
  items: [],
  openDepth: 1,
  click: (nodeItem) => {},
  dblclick: (nodeItem) => {},
} as Options;

interface ComponentMap {
  [key: string]: Tree;
}

// all instance
const allInstance: ComponentMap = {};

// edit default option
const EDIT_DEFAULT_OPTIONS = {
  before: false,
  after: false,
};

/**
 * Tree class
 *
 * @class Tree
 * @typedef {Tree}
 */
export default class Tree {
  public options;

  private orginStyle;
  private orginStyleClass;

  private selector: string;

  private prefix: string;

  public mainElement: HTMLElement;

  public config: ConfigInfo;

  constructor(selector: string, options: Options, message: Message) {
    const mainElement = document.querySelector<HTMLElement>(selector);
    if (!mainElement) {
      throw new Error(`${selector} tree selector not found`);
    }

    this.options = utils.objectMerge({}, defaultOptions, options);

    this.orginStyleClass = mainElement.className;
    mainElement.classList.add("dara-tree");

    if (this.options.style) {
      let style = [];

      let addStyle = (this.orginStyle = mainElement.getAttribute("style")) || "";
      if (this.options.style.width) {
        addStyle = addStyle.replace(/(width:).+?(;[\s]?|$)/g, "");

        style.push(`width:${this.options.style.width};`);
      }
      if (this.options.style.height) {
        addStyle = addStyle.replace(/(height:).+?(;[\s]?|$)/g, "");

        style.push(`height:${this.options.style.height};`);
      }

      style.push(addStyle ? addStyle + ";" : "");

      mainElement.setAttribute("style", style.join(""));
    }

    this.selector = selector;
    this.mainElement = mainElement;

    this.prefix = "dt" + utils.getHashCode(selector);

    this.initConfig();

    this.init();

    allInstance[selector] = this;
  }

  private initConfig() {
    this.config = {
      startPaddingLeft: this.options.enableRootNode ? this.options.style.paddingLeft : 0,
      rootDepth: this.options.enableRootNode ? 0 : 1,
      allNode: {},
      openNodeId: null,
      selectedNode: null,
      focusNode: null,
      isFocus: false,
      rootNode: {},
      isCheckbox: !utils.isUndefined(this.options.plugins["checkbox"]),
      isDnd: !utils.isUndefined(this.options.plugins["dnd"]),
      isContextmenu: !utils.isUndefined(this.options.plugins["contextmenu"]),
      isEdit: false,
      isKeydown: !utils.isUndefined(this.options.plugins["keydown"]),
      isNodeDrag: false,
      isAjax: false,
    } as ConfigInfo;

    this.config.rootNode = new TreeNodeInfo(utils.objectMerge({}, this.options.rootNode), "$$root$$", this);
    this.config.allNode[this.config.rootNode.id] = this.config.rootNode;
    this.config.selectedNode = this.config.rootNode;
    this.config.openNodeId = this.config.rootNode.id;

    if (this.options.plugins["edit"]) {
      this.config.isEdit = true;
      this.options.plugins["edit"] = utils.objectMerge({}, EDIT_DEFAULT_OPTIONS, this.options.plugins["edit"]);
    }

    this.config.ajax = new Ajax(this);
  }

  public init() {
    this.initEvt();
    this.request();
  }

  private initEvt() {
    if (this.config.isKeydown) {
      this.config.keydown = new Keydown(this);
    }

    treeEvent.expanderClick(this, this.mainElement);

    if (this.config.isDnd) {
      this.config.dnd = new Dnd(this);
    }

    if (this.config.isCheckbox) {
      this.config.checkbox = new Checkbox(this);
    }

    treeEvent.textClick(this, this.mainElement);
  }

  public static setMessage(message: Message): void {
    Lanauage.set(message);
  }

  public request() {
    const opts = this.options;

    if (this.config.isAjax) {
      this.config.ajax.search(this.config.allNode[this.config.openNodeId]);
    } else if (utils.isArray(opts.items)) {
      this.addNode(opts.items);
    }
  }

  public refresh(id: any) {
    const refreshNode = this.config.allNode[id];

    if (!refreshNode) {
      throw new Error(`node not found : [${id}] `);
    }

    refreshNode.isLoaded = false;
    this.config.openNodeId = id;
    this.request();
  }

  /**
   * tree node 추가.
   *
   * @param nodeItem {object|array} add node items
   * @param parentId {any} parent id
   * @param options {Object} add options
   */
  public addNode(nodeItem: any[] | any, parentId?: any, options?: any) {
    let nodeArr = [];
    if (!utils.isArray(nodeItem)) {
      nodeArr.push(nodeItem);
    } else {
      nodeArr = nodeItem;
    }

    for (const node of nodeArr) {
      this.treeGrid(node, parentId);
    }
    this.config.openNodeId = !utils.isUndefined(parentId) ? parentId : this.config.openNodeId;

    this.render();

    this.config.openNodeId = null;
  }

  public createNode(nodeInfo: any) {
    nodeInfo = nodeInfo ?? {};
    nodeInfo["_cud"] = "C";
    nodeInfo[this.options.itemKey.pid] = nodeInfo.pid ?? nodeInfo[this.options.itemKey.pid] ?? (this.config.selectedNode ? this.config.selectedNode.id : "");
    nodeInfo[this.options.itemKey.id] = nodeInfo.id ?? nodeInfo[this.options.itemKey.id] ?? utils.generateUUID();
    nodeInfo[this.options.itemKey.text] = nodeInfo.text ?? nodeInfo[this.options.itemKey.text] ?? "New Node";

    this.addNode(nodeInfo);

    this.config.ajax.create(nodeInfo);
  }

  private treeGrid(node: any, parentId?: any) {
    const pid = parentId ?? node[this.options.itemKey.pid];
    const id = node[this.options.itemKey.id];

    if (this.config.rootNode.id === id) {
      this.config.rootNode.orgin = node;
      return;
    }

    if (utils.isBlank(this.config.rootNode.id)) {
      delete this.config.allNode[this.config.rootNode.id];
      this.config.rootNode.id = pid;
      this.config.allNode[this.config.rootNode.id] = this.config.rootNode;
    }

    const addNode = new TreeNodeInfo(node, pid, this);
    const parentNode = this.config.allNode[pid];

    if (parentNode) {
      parentNode.addChild(addNode);

      if (parentNode.checkState == CHECK_STATE.CHECKED) {
        addNode.checkState = CHECK_STATE.CHECKED;
      }
    } else {
      this.config.rootNode.addChild(addNode);
    }

    if (node.children && node.children.length > 0) {
      for (const childNode of node.children) {
        this.addNode(childNode);
      }
    }

    this.config.allNode[id] = addNode;
  }

  private render() {
    const id = this.config.openNodeId;
    console.log("render(id?: any)  ", id, this.config.rootNode);
    if (id == null || id === this.config.rootNode.id) {
      // init load
      this.mainElement.innerHTML = `<ul id="${this.prefix}" class="dt-container" tabindex="-1">
        ${this.getNodeTemplate([this.config.rootNode])}
        </ul>`;
    } else {
      let selectedNode = this.config.allNode[id] ?? this.config.selectedNode;

      console.log(id, this.config.selectedNode, selectedNode);

      const childNodeElemnt = this.mainElement.querySelector(`[data-node-id="${selectedNode.id}"]>.dt-children`);
      if (childNodeElemnt) {
        childNodeElemnt.innerHTML = this.getNodeTemplate(selectedNode.childNodes);
      }

      const parentElement = this.mainElement.querySelector(`[data-node-id="${selectedNode.id}"]>.dt-node`);
      if (parentElement) {
        parentElement.innerHTML = this.nodeContentHtml(selectedNode);
      }
    }
  }

  private getNodeTemplate(viewNodes: TreeNode[]): string {
    const treeHtml = [];
    viewNodes = viewNodes ?? this.config.rootNode.childNodes;
    const childNodeLength = viewNodes.length;

    let stylePaddingLeft = childNodeLength > 0 ? nodeUtils.textContentPadding(viewNodes[0].depth, this) : 0;

    for (let i = 0; i < childNodeLength; i++) {
      let treeNode = viewNodes[i];

      let childNodes = treeNode.childNodes;
      let openClass = "";
      if (treeNode.isOpen) {
        if (treeNode.getChildLength() > 0) {
          openClass = "open";
          treeNode.isOpen = true;
        } else {
          treeNode.isOpen = false;
        }
      }

      if (treeNode.depth == 0) {
        treeHtml.push(
          `<li data-node-id="${treeNode.id}" class="open">
              <div class="dt-node" style="display:${this.options.enableRootNode ? "inline" : "none"}">
                ${this.nodeContentHtml(treeNode)}
              </div>
              <ul id="c_${treeNode.id}" class="dt-children">${this.getNodeTemplate(childNodes)}</ul>
            </li>`
        );
      } else {
        treeHtml.push(
          `<li data-node-id="${treeNode.id}" class="${openClass}">
            <div class="dt-node" style="padding-left:${stylePaddingLeft}px" draggable="true">
              ${this.nodeContentHtml(treeNode)}
            </div>
            <ul class="dt-children">${treeNode.getChildLength() == 0 ? "" : this.getNodeTemplate(childNodes)}</ul>
          </li>`
        );
      }
    }

    return treeHtml.join("");
  }

  private nodeContentHtml(node: TreeNode) {
    return this.getExpandIconHtml(node) + this.getNodeNameHtml(node);
  }

  private getExpandIconHtml(node: TreeNode) {
    return `<i class="dt-expander ${node.isFolder === true || node.getChildLength() > 0 ? "visible" : ""}"></i>`;
  }

  private getNodeNameHtml(node: TreeNode) {
    let icon = node.icon;
    let iconHtml = "";
    if (utils.isBlank(icon)) {
      icon = node.getChildLength() == 0 ? "dt-file" : "dt-folder";
      if (this.options.enableIcon) {
        iconHtml = `<i class="dt-icon ${icon}"></i>`;
      }
    } else {
      iconHtml = `<i class="dt-icon ${icon}"></i>`;
    }

    let checkboxHtml = "";
    if (this.config.isCheckbox) {
      checkboxHtml = `<label class="dt-checkbox"><span class="dt-icon checkbox"></span></label>`;
    }

    return `${checkboxHtml}<span class="dt-text-content">${iconHtml}<span>${node.text}</span></span>`;
  }

  public getPrefix() {
    return this.prefix;
  }

  /**
   * 설정 옵션 얻기
   */
  public getOptions = () => {
    return this.options;
  };

  /**
   * set items
   * @param items {array} items
   */
  public setItems(items: any[]) {
    this.options.items = items;
  }

  public static instance(selector?: string) {
    if (utils.isUndefined(selector) || utils.isBlank(selector)) {
      const keys = Object.keys(allInstance);
      if (keys.length > 1) {
        throw new Error(`selector empty : [${selector}]`);
      }
      selector = keys[0];
    }

    return allInstance[selector];
  }

  public destroy = () => {
    domUtils.setAttribute(this.mainElement, { class: this.orginStyleClass, style: this.orginStyle });
    this.mainElement.replaceChildren();

    for (const key in this) {
      if (utils.hasOwnProp(this, key)) {
        delete this[key];
        delete allInstance[this.selector];
      }
    }
  };

  /**
   * check 아이템 얻기
   *
   * @returns check tree nodes
   */
  public getCheckValues() {
    return this.config.checkbox.getCheckValues();
  }

  /**
   * 전체 노드 열기
   */
  public allOpen() {
    this.config.rootNode.open(true);
  }

  /**
   * 전체 노드 닫기
   */
  public allClose() {
    this.config.rootNode.close(true);
  }

  /**
   * 트리 노드 정보 얻기
   *
   * @param id tree id
   * @returns  tree node 정보
   */
  public getNodes(id: any): TreeNode {
    return this.config.allNode[id];
  }

  /**
   * 노드 선택하기
   *
   * @param id tree id
   */
  public setSelectNode(id: any) {
    const node = this.config.allNode[id];

    if (node) {
      node.select();
    }
  }

  /**
   * 선택된 tree node 값 얻기.
   *
   * @returns {TreeNode} 선택된 tree node
   */
  public getSelectNode(): TreeNode | undefined {
    const selectElement = this.mainElement.querySelector(".selected");
    if (selectElement) {
      return nodeUtils.elementToTreeNode(selectElement, this);
    }
  }

  /**
   *
   * @returns {TreeNode[]} check된 tree node 값
   */
  public getCheckNodes(): TreeNode[] {
    return this.config.checkbox.getCheckValues();
  }

  /**
   * 노드 삭제 하기.
   *
   * @param id tree node id
   * @returns 삭제된 노드 값
   */
  public remove(...ids: any[]) {
    const reval = [];
    for (const id of ids) {
      const removeNode = this.config.allNode[id];

      if (removeNode) {
        reval.push(removeNode.remove());
      } else {
        reval.push(`id not found [${id}]`);
      }
    }
    return reval;
  }
}
