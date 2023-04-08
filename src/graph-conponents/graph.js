import { nodeInfoConfig, edgeInfoConfig } from './common/static-const-value.js';
import { renderLegend } from './common/util-function.js';

const { watch } = Vue

export default class Graph {
    constructor(props = {}) {
        // 表节点的typeName，后面比较要用
        this.tableType = 'dli.Table';
        this.columnType = 'dli.Column';
        this.jobType = 'dlf.JobNode';

        // 滑块对应的参数，为了简化逻辑，in、out可以同时作用，但是和总数不能同时作用；
        this.maxDepth = 0;
        this.maxColumnNums = 0;
        this.maxInConsanguinity = 0;
        this.maxOutConsanguinity = 0;
        this.maxTotalConsanguinity = 0;

        this.curDepth = 0;
        this.curInConsanguinity = -1;
        this.curOutConsanguinity = -1;
        this.curTotalConsanguinity = -1;
        this.curColumnNums = -1;

        // 图谱渲染
        this.container = 'graph-container';
        this.selector = 'graph-render';
        this.legendContainer = 'legend-container';
        this.width = 0;
        this.height = 0;
        this.radius = 0;
        this.circleLineWidth = 1; // 节点外圈线宽(节点外线圈默认值为1)
        this.hiddenFactor = '20'; // 隐藏时的淡化系数
        this.allNodeMapByGuid = new Map();
        // 边集，没什么用
        this.allEdgeMapByGuid = new Map();
        // 指向该节点的节点集合
        this.allNodeInNeighborMapByGuid = new Map();
        // 被该节点指向的节点集合
        this.allNodeOutNeighborMapByGuid = new Map();

        this.highlightNodes = new Set()

        this.pathNodes = new Set();
        this.pathExplore = false;
        this.nodeGuidToIsLastNode = new Map();

        this.transformObj = d3.zoomIdentity; // 放缩偏移对象
        this.openRenderAnimation = false; // 是否开启初始渲染动画
        this.preTickCount = 150; // 预计算次数
        this.hiddenFilterType = {
            nodeFilter: [],
            edgeFilter: [],
        }; // 点边过滤器


        Object.assign(this, props);

        this.init();
        this.render();
        if (!this.openRenderAnimation) {
            this.simulation.tick(this.preTickCount);
            this.simulation.stop();
            this.renderRefresh();
        }
        this.bindEvent();
        // 监视curHighlightDataset的修改
        watch(this.curHighlightDataset, async newValue => {
            // 选择'无'清空高亮节点集合
            if (newValue === '无') {
                this.highlightNodes = new Set()
                return
            }
            // 等待数据读完
            await d3.json(`../../dataset/highlight/${newValue}.json`)
                .then(data => {
                    this.highlightNodes = new Set()
                    data.forEach(guid => {
                        this.highlightNodes.add(guid)
                    })
                })
            this.renderRefresh()
        })

        // // 监视showList的修改
        // watch(this.showList, async newValue =>{
        //     console.log("showList修改");
        // })

        // 相应空格和左右键
        let isRestart = false;
        document.onkeydown = (event) => {
            if (event.key === ' ') {
                if (isRestart) {
                    this.simulation.restart();
                }
                else {
                    this.simulation.stop();
                }
                isRestart = !isRestart;
            }
            else if (event.key === 'ArrowLeft') {
                this.switchDatasetByKey('left');
            }
            else if (event.key === 'ArrowRight') {
                this.switchDatasetByKey('right');
            }
        };
    }

    init() {
        // 添加元素以及画笔对象
        this.canvas = d3
            .select(`#${this.container}`)
            .append('canvas')
            .attr('id', this.selector)
            .attr('width', this.width)
            .attr('height', this.height);
        this.ctx = this.canvas.node().getContext('2d');

        // 设置点边数据哈希
        this.data.nodes.forEach((d) => {
            d.r = this.radius;

            // 下面的属性仅对表节点有用，对其他类型节点无用，但是为了便于遍历，不做过度区分
            // 字段数
            d.columnNum = 0;

            // 深度
            d.depth = 0;

            //血缘度
            d.totalConsanguinity = 0;
            d.inConsanguinity = 0;
            d.outConsanguinity = 0;

            // 高度和最长路中上一个以及下一个节点编号，用来辅助查找最长路，因为可能不止一条，就采用set集合
            d.height = 0;
            d.pre = new Set();
            d.next = new Set();

            this.allNodeMapByGuid.set(d.guid, d);
            this.allNodeInNeighborMapByGuid.set(d.guid, []);
            this.allNodeOutNeighborMapByGuid.set(d.guid, []);
            this.nodeGuidToIsLastNode.set(d.guid, true);
        });

        this.data.edges.forEach((d) => {
            d.sourceId = typeof d.source === 'string' ? d.source : d.source.guid;
            d.targetId = typeof d.target === 'string' ? d.target : d.target.guid;
            this.allEdgeMapByGuid.set(d.guid, d);
            this.allNodeOutNeighborMapByGuid.set(d.sourceId, this.allNodeOutNeighborMapByGuid.get(d.sourceId).concat(d.targetId));
            this.allNodeInNeighborMapByGuid.set(d.targetId, this.allNodeInNeighborMapByGuid.get(d.targetId).concat(d.sourceId))

            // this.allNodeMapByGuid.get(d.targetId).inDegree += 1;
            if (d.sourceTypeName === this.jobType && d.targetTypeName === this.tableType) {
                this.allNodeMapByGuid.get(d.targetId).inConsanguinity += 1;
                this.allNodeMapByGuid.get(d.targetId).totalConsanguinity += 1;
                this.maxInConsanguinity = Math.max(this.maxInConsanguinity, this.allNodeMapByGuid.get(d.targetId).inConsanguinity);
                this.maxTotalConsanguinity = Math.max(this.maxTotalConsanguinity, this.allNodeMapByGuid.get(d.targetId).totalConsanguinity);
            }

            if (d.sourceTypeName === this.tableType && d.targetTypeName === this.jobType) {
                this.allNodeMapByGuid.get(d.sourceId).outConsanguinity += 1;
                this.allNodeMapByGuid.get(d.sourceId).totalConsanguinity += 1;
                this.maxOutConsanguinity = Math.max(this.maxOutConsanguinity, this.allNodeMapByGuid.get(d.sourceId).outConsanguinity);
                this.maxTotalConsanguinity = Math.max(this.maxTotalConsanguinity, this.allNodeMapByGuid.get(d.sourceId).totalConsanguinity);
                this.nodeGuidToIsLastNode.set(d.sourceId, false);
            }
            // 如果遇到表->表字段，增加表节点的字段数
            if (d.sourceTypeName === this.tableType && d.targetTypeName === this.columnType) {
                this.allNodeMapByGuid.get(d.sourceId).columnNum += 1;
                this.maxColumnNums = Math.max(this.maxColumnNums, this.allNodeMapByGuid.get(d.sourceId).columnNum);
            }
        });

        // 添加路径监听
        document.querySelector('#pathExplore').addEventListener('click', event => {
            this.pathExplore = !this.pathExplore;
            if (this.pathExplore)
                event.target.innerHTML = '关闭路径探索';
            else {
                event.target.innerHTML = '开启路径探索';
                this.pathNodes = new Set();
            }
        });

        this.countTableNodeDepth();

    }

    /**
     * 计算table节点的深度，如果一个table有多个深度，取最大深度。
     * 从血缘入度为0的table节点开始，通过dfs逐渐深入
     */
    countTableNodeDepth() {
        this.data.nodes.forEach((node) => {
            if (node.typeName === this.tableType && node.inConsanguinity === 0) {
                this.dfs(node, { depth: 0 });
            }
        });
    }

    /**
     * 从指定节点开始继续往下进行深度优先遍历
     * 我们规定每个节点都有深度，同时，只有经过一个table节点深度才有可能改变
     * @param {object} node 即将遍历的节点
     * @param {number} depth 上一个节点所处深度
     */
    dfs(node, preNode) {
        // 如果当前节点的深度已经大于depth + 1，没有必要处理这个节点和它的子孙，它们的深度一定不会被更新
        // if (preNode.depth + 1 <= node.depth) {
        //     return;
        // }
        let isTableNode = node.typeName === this.tableType;
        let isJobNode = node.typeName === this.jobType;
        let isLastNode = this.nodeGuidToIsLastNode.get(node.guid);

        if (isTableNode && isLastNode) {
            node.height = 1;
        }

        if (preNode.depth + 1 > node.depth) {
            node.depth = preNode.depth;
            if (preNode.guid) {
                node.pre.add(preNode.guid);
                preNode.next.add(node.guid);
            }

            // 如果当前节点是table节点，则depth需要加1
            if (isTableNode) {
                node.depth++;
            }

            this.maxDepth = Math.max(this.maxDepth, node.depth);
        }

        // 遍历该节点指向的节点
        let targetNode;
        this.allNodeOutNeighborMapByGuid.get(node.guid).forEach((targetNodeGuid) => {
            targetNode = this.allNodeMapByGuid.get(targetNodeGuid);
            this.dfs(targetNode, node);
            // job节点只有一条出边，因此高度一定等于它的目标节点的高度
            if (isJobNode) {
                node.height = targetNode.height;
                node.next.add(targetNodeGuid);
            } else if (isTableNode && node.height == targetNode.height + 1) {
                node.next.add(targetNodeGuid);
            } else if (isTableNode && node.height < targetNode.height + 1) {
                node.height = targetNode.height + 1;
                node.next.clear();
                node.next.add(targetNodeGuid);
            }
        });
    }

    /**
     * 进行布局渲染
     */
    render() {
        // 设置力仿真器
        this.simulation = d3
            .forceSimulation()
            .nodes(this.data.nodes.filter(node => this.hiddenFilterType.nodeFilter.indexOf(node.typeName) === -1))
            // .nodes(this.data.nodes)
            .force('charge', this.openRenderAnimation
                ? d3.forceManyBody().strength(-50)
                : d3.forceManyBodyReuse().strength(-50))
            .force('link', d3.forceLink(this.data.edges.filter(edge =>
            (this.hiddenFilterType.nodeFilter.indexOf(edge.sourceTypeName) === -1 &&
                this.hiddenFilterType.nodeFilter.indexOf(edge.targetTypeName) === -1 &&
                this.hiddenFilterType.edgeFilter.indexOf(edge.relationshipTypeName) === -1)
            )).id((d) => d.guid)
                // .distance(30)
            )
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collide', d3.forceCollide((d) => d.r))
            .force('x', d3.forceX(this.width / 2).strength(0.016))
            .force('y', d3.forceY(this.height / 2).strength(0.016))
            .on('tick', () => {
                this.renderRefresh();
            });
        // 绘制节点图例
        const legendMap = new Map();
        this.data.nodes.forEach((d) => {
            if (!legendMap.has(d.typeName)) {
                legendMap.set(d.typeName, 1);
            }
            else {
                legendMap.set(d.typeName, legendMap.get(d.typeName) + 1);
            }
        });
        const legendList = [...legendMap.entries()].map((d) => ({
            typeName: d[0],
            num: d[1],
        }));
        renderLegend(this.legendContainer, legendList);
        // console.log(legendList)
    }

    /**
     * 事件绑定
     */
    bindEvent() {
        // 右键菜单
        document.oncontextmenu = (event) => {
            const x = this.transformObj.invertX(event.layerX);
            const y = this.transformObj.invertY(event.layerY);
            const node = this.findOperateNode(x, y);
            if (node) {
                node.x = this.transformObj.applyX(node.x);
                node.y = this.transformObj.applyY(node.y);
                console.log('右键', node);
            }
            // 禁止浏览器唤出默认的右键菜单
            return false;
        };


        this.canvas
            .on('click', (event) => {

                let node = this.clickSubject;
                if (node != null) {
                    console.log(node);
                }
                // 如果是数据表节点，先判断其是否在showList数组，如果不在加入showList数组，如果在则移除
                if (node.typeName == this.tableType) {
                    if(this.inShowList(node.guid)) {
                        this.showListRemove(node.guid);
                        this.highlightNodes.delete(node.guid);
                    }else {
                        this.showListAdd(node.guid);
                        this.highlightNodes.add(node.guid);
                    }
                }

                // 重新渲染
                this.renderRefresh();
                if (!this.pathExplore || node == null) return;
                this.pathNodes = [node.guid];
                let set = new Set();
                // 向上找到让当前节点所处深度最深的路径
                set.add(node.pre);
                while (set.size !== 0) {
                    set.forEach(nodeGuidSet => {
                        set.delete(nodeGuidSet);
                        if (!nodeGuidSet) return;
                        // concat函数不改变任何已有数组
                        this.pathNodes = this.pathNodes.concat([...nodeGuidSet]);
                        nodeGuidSet.forEach(guid => {
                            if (!guid) return;
                            let node = this.allNodeMapByGuid.get(guid);
                            // console.log(guid);
                            // if ('pre' in node)
                            set.add(node.pre);
                        });
                    })
                }

                // 向下找到让当前节点所处高度最高的路径
                set.add(node.next);
                while (set.size !== 0) {
                    set.forEach(nodeGuidSet => {
                        set.delete(nodeGuidSet);
                        if (!nodeGuidSet) return;
                        // concat函数不改变任何已有数组
                        this.pathNodes = this.pathNodes.concat([...nodeGuidSet]);
                        nodeGuidSet.forEach(guid => {
                            if (!guid) return;
                            let node = this.allNodeMapByGuid.get(guid);
                            // console.log(guid);
                            // if ('pre' in node)
                            set.add(node.next);
                        });
                    })
                }

                this.pathNodes = new Set(this.pathNodes);
                this.clickSubject = null;
            })
            // 拖拽
            .call(d3
                .drag()
                .subject((event) => this.dragSubject(event))
                .on('start', (event) => {
                    // TODO: 修正点击事件与拖拽事件的冲突检测，可考虑在drag中加入拖拽标志符
                    // console.log(1);
                    // 使用drag辅助click完成subject选择
                    this.clickSubject = event.subject;

                    if (!event.active)
                        this.simulation.alphaTarget(0.3).restart();
                    event.subject.fx = this.transformObj.invertX(event.x);
                    event.subject.fy = this.transformObj.invertY(event.y);
                })
                .on('drag', (event) => {
                    // console.log(2);
                    event.subject.fx = this.transformObj.invertX(event.x);
                    event.subject.fy = this.transformObj.invertY(event.y);
                })
                .on('end', (event) => {
                    // console.log(3);
                    if (!event.active)
                        this.simulation.alphaTarget(0);
                    // event.subject.fx = null;
                    // event.subject.fy = null;
                }))
            // 缩放
            .call(d3
                .zoom()
                .scaleExtent([1 / 100, 930])
                .on('zoom', (event) => {
                    this.transformObj = event.transform;
                    this.renderRefresh();
                }))
            // 阻止默认的双击放缩事件
            .on('dblclick.zoom', null);
    }

    /**
     * 画布刷新式渲染
     */
    renderRefresh() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.translate(this.transformObj.x, this.transformObj.y);
        this.ctx.scale(this.transformObj.k, this.transformObj.k);
        this.drawEdges();
        this.drawNodes();
        this.ctx.restore();
    }
    /**
     * canvas 绘制连边
     */
    drawEdges() {
        // 绘制连边实体
        this.data.edges.forEach((d) => {
            this.ctx.beginPath();
            // 两节点间的间距
            const distance = Math.hypot(d.source.x - d.target.x, d.source.y - d.target.y);
            // 重新定义端节点位置
            const radiusPadding = this.circleLineWidth; // 半径偏移量
            const newSourceNode = {
                x: ((distance - this.radius) / distance) * (d.source.x - d.target.x) +
                    d.target.x,
                y: ((distance - this.radius) / distance) * (d.source.y - d.target.y) +
                    d.target.y,
            };
            const newTargetNode = {
                x: ((this.radius + radiusPadding) / distance) *
                    (d.source.x - d.target.x) +
                    d.target.x,
                y: ((this.radius + radiusPadding) / distance) *
                    (d.source.y - d.target.y) +
                    d.target.y,
            };
            this.ctx.moveTo(newSourceNode.x, newSourceNode.y);
            this.ctx.lineTo(newTargetNode.x, newTargetNode.y);
            const isHidden = !(this.hiddenFilterType.nodeFilter.indexOf(d.sourceTypeName) === -1 &&
                this.hiddenFilterType.nodeFilter.indexOf(d.targetTypeName) === -1 &&
                this.hiddenFilterType.edgeFilter.indexOf(d.relationshipTypeName) === -1);
            this.ctx.strokeStyle = isHidden
                ? edgeInfoConfig[d.relationshipTypeName].color + this.hiddenFactor
                : edgeInfoConfig[d.relationshipTypeName].color;
            if (this.pathExplore && this.pathNodes.has(d.sourceId) && this.pathNodes.has(d.targetId)) {
                this.ctx.strokeStyle = 'red';
                this.ctx.lineWidth = '20px';
            }
            this.drawArrow(newSourceNode, newTargetNode);
            this.ctx.stroke();
        });
    }

    /**
     * 绘制箭头
     * @param source 连边源节点
     * @param target 连边目标节点
     * @param headlen 箭头长度
     * @param theta 箭头与直线夹角
     */
    drawArrow(source, target, headlen = this.radius * 0.8, theta = 30) {
        // 计算各角度和对应的箭头终点坐标
        const angle = (Math.atan2(source.y - target.y, source.x - target.x) * 180) / Math.PI;
        const angle1 = ((angle + theta) * Math.PI) / 180;
        const angle2 = ((angle - theta) * Math.PI) / 180;
        const topX = headlen * Math.cos(angle1);
        const topY = headlen * Math.sin(angle1);
        const botX = headlen * Math.cos(angle2);
        const botY = headlen * Math.sin(angle2);
        this.ctx.moveTo(target.x + topX, target.y + topY);
        // 绘制两边箭头
        this.ctx.lineTo(target.x, target.y);
        this.ctx.lineTo(target.x + botX, target.y + botY);
    }

    /**
     * canvas 绘制节点
     */
    drawNodes() {
        // 绘制节点实体
        this.data.nodes.forEach((d) => {
            this.ctx.beginPath();
            this.ctx.moveTo(d.x + this.radius, d.y);

            const isTable = d.typeName === this.tableType;
            const inPath = this.pathNodes.has(d.guid);
            const isSrcTable = isTable && d.inConsanguinity === 0
            const isDstTable = isTable && d.outConsanguinity === 0
            const isMidTable = isTable && !isSrcTable && !isDstTable
            if (this.pathExplore && inPath || this.highlightNodes.has(d.guid) || this.highlightSrcTable.value && isSrcTable || this.highlightDstTable.value && isDstTable || this.highlightMidTable.value && isMidTable) {
                this.ctx.fillStyle = 'red';
                this.ctx.arc(d.x, d.y, this.radius + 2, 0, 2 * Math.PI);
            } else {
                // 数据表节点有多种颜色，需要特殊处理
                if(d.typeName == 'dli.Table') {
                    // 根据数据表拥有的字段数量划分类型，填充不同的颜色
                    const whichType = Math.floor(d.column_num / 5)
                    switch (whichType) {
                        case 0:
                        case 1:
                        case 2:
                            // this.ctx.fillStyle = nodeInfoConfig[d.typeName].color.c2
                            // break;
                        case 3:
                        case 4:
                            this.ctx.fillStyle = nodeInfoConfig[d.typeName].color.c2
                            break;
                        default:
                            this.ctx.fillStyle = nodeInfoConfig[d.typeName].color.c3
                    }

                }
                else {
                    this.ctx.fillStyle = nodeInfoConfig[d.typeName].color
                }
                // this.ctx.fillStyle = this.hiddenFilterType.nodeFilter.indexOf(d.typeName) !== -1
                //     ? nodeInfoConfig[d.typeName].color + this.hiddenFactor
                //     : nodeInfoConfig[d.typeName].color;
                this.ctx.arc(d.x, d.y, this.radius, 0, 2 * Math.PI);
            }

            this.ctx.fill();
            // 绘制节点中心标签
            // this.ctx.font = '12px Times New Roman';
            // this.ctx.fillStyle =
            //     this.openBlurExplore && !this.blurExploreNodesSet.has(d.guid)
            //         ? '#000000' + this.hiddenFactor
            //         : this.hiddenFilterType.nodeFilter.indexOf(d.typeName) !== -1
            //             ? '#000000' + this.hiddenFactor
            //             : '#000000';
            // this.ctx.textAlign = 'center';
            // this.ctx.textBaseline = 'middle';
            // this.ctx.fillText(nodeInfoConfig[d.typeName].iconLabel + d.depth, d.x, d.y);
        });
    }

    /**
     * 寻找拖拽的目标节点
     * @param event
     * @returns
     */
    dragSubject(event) {
        const x = this.transformObj.invertX(event.x);
        const y = this.transformObj.invertY(event.y);
        const node = this.findOperateNode(x, y);
        if (node) {
            node.x = this.transformObj.applyX(node.x);
            node.y = this.transformObj.applyY(node.y);
        }
        return node;
    }
    /**
     * 在canvas中寻找操作的节点
     * @param x
     * @param y
     * @returns
     */
    findOperateNode(x, y) {
        const rSq = this.radius * this.radius;
        const node = this.data.nodes.find((d) => Math.pow((x - d.x), 2) + Math.pow((y - d.y), 2) < rSq);
        return node;
    }
}
