import { Options } from "@t/Options";
import utils from "../util/utils";
import nodeUtils from "src/util/nodeUtils";
import DaraTree from "../DaraTree";
import domUtils from "../util/domUtils";
import { TreeNode } from "@t/TreeNode";
import { CHECK_STATE } from "../constants";

/**
 * Daratree class
 *
 * @class Daratree
 * @typedef {Daratree}
 */
export default class Checkbox {
  private daraTree;

  constructor(daraTree: DaraTree) {
    this.daraTree = daraTree;

    this.initCheck();
    this.initEvt();
  }

  initCheck() {
    for (const node of this.daraTree.config.rootNodes) {
      this.initChildNodeCheck(node);
    }
  }

  /**
   * init child node check
   * @param node treenode
   */
  private initChildNodeCheck(node: TreeNode) {
    if (node.checkState == CHECK_STATE.CHECKED) {
      this.parentNodeCheck(node);
      this.childCheck(node, CHECK_STATE.CHECKED);
    } else if (node.childNodes.length > 0) {
      for (const childNode of node.childNodes) {
        this.initChildNodeCheck(childNode);
      }
    }
  }

  /**
   * parent node check box 처리
   * @param node treenode
   */
  private parentNodeCheck(node: TreeNode) {
    const parentNode = this.daraTree.config.allNode[node.pid];

    if (parentNode) {
      let indeterminateCount = 0;
      let unCheckCount = 0;
      for (const childNode of parentNode.childNodes) {
        if (childNode.checkState == CHECK_STATE.UNCHECKED) {
          ++unCheckCount;
        } else if (childNode.checkState == CHECK_STATE.INDETERMINATE) {
          ++indeterminateCount;
        }
      }

      if (indeterminateCount + unCheckCount > 0) {
        if (unCheckCount == parentNode.childNodes.length) {
          this.setCheckBox(parentNode.id, CHECK_STATE.UNCHECKED);
        } else {
          this.setCheckBox(parentNode.id, CHECK_STATE.INDETERMINATE);
        }
      } else {
        this.setCheckBox(parentNode.id, CHECK_STATE.CHECKED);
      }

      this.parentNodeCheck(parentNode);
    }
  }

  initEvt() {
    domUtils.eventOn(this.daraTree.mainElement, "click", ".dt-text-content>.dt-checkbox", (e: Event, ele: Element) => {
      const checkboxEle = ele.closest(".dt-checkbox");

      e.preventDefault();
      e.stopImmediatePropagation();

      if (checkboxEle) {
        const nodeInfo = nodeUtils.elementToTreeNode(ele, this.daraTree);

        if (nodeInfo.checkState == CHECK_STATE.CHECKED) {
          this.childCheck(nodeInfo, CHECK_STATE.UNCHECKED);
        } else {
          this.childCheck(nodeInfo, CHECK_STATE.CHECKED);
        }

        this.parentNodeCheck(nodeInfo);
      }
    });
  }

  public childCheck(node: TreeNode, state: number) {
    this.setCheckBox(node.id, state);

    if (node.childNodes.length > 0) {
      for (let childNode of node.childNodes) {
        this.childCheck(childNode, state);
      }
    }
  }

  /**
   * 체크 박스 체크 하기.
   *
   * @param itemEle {Element} node
   * @param flag {Boolean} true or false
   * @returns nodeid
   */
  public setCheckBox(id: string | number, state: number) {
    const ele = this.daraTree.mainElement.querySelector(`[data-node-id="${id}"] .dt-checkbox`);
    const node = this.daraTree.config.allNode[id];

    if (ele) {
      node.checkState = state;
      domUtils.removeClass(ele, "dt-indeterminate");
      switch (state) {
        case CHECK_STATE.CHECKED:
          domUtils.addClass(ele, "dt-checked");
          break;
        case CHECK_STATE.UNCHECKED:
          domUtils.removeClass(ele, "dt-checked");
          break;
        case CHECK_STATE.INDETERMINATE:
          domUtils.addClass(ele, "dt-indeterminate");
          break;
        default:
          return;
      }
    }
  }

  public getCheckValues() {
    let checkNodeValues = [] as any[];

    for (const node of this.daraTree.config.rootNodes) {
      _getCheckValue(checkNodeValues, node);
    }

    return checkNodeValues;
  }
}

function _getCheckValue(checkNodeValues: any[], node: any) {
  if (node.checkState != CHECK_STATE.UNCHECKED) {
    checkNodeValues.push(node);
  }

  if (node.childNodes.length > 0) {
    for (const childNode of node.childNodes) {
      _getCheckValue(checkNodeValues, childNode);
    }
  }
}
