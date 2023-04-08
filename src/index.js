// 导入图谱类
import Graph from './graph-conponents/graph.js';

(function () {
    const { createApp, reactive, toRefs, toRaw, onMounted, toRef, computed } = Vue;
    const app = createApp({
        setup() {
            // 响应式数据
            const reactiveData = reactive({
                // 数据集
                datasetList: [],
                originalHighlightList: [],
                highlightList: [],
                showList: [],
                columns:[
                    {
                        title: '序号',
                        dataIndex: 'num',
                        key: 'num',
                        width: 50,
                    },
                    {
                        title: '数据表id',
                        dataIndex: 'table_id',
                        key: 'table_id',
                    }
                ],
                dataset: '',
                curHighlightDataset: '',
                originalGraph: {
                    nodeNum: 0,
                    edgeNum: 0,
                },
                curDatasetIndex: 7,
                // 是否开启动画渲染
                openRenderAnimation: true,
                // 节点过滤
                filterMethodList: [
                    {
                        value: '',
                        label: '不开启过滤',
                    },
                    {
                        value: 'delete',
                        label: '删除',
                    },
                    {
                        value: 'hidden',
                        label: '隐藏',
                    },
                ],
                filterMethod: '',
                nodeTypeNameList: [],
                nodeFilter: [],
                edgeTypeNameList: [],
                edgeFilter: [],
                curNodesNum: 0,
                curEdgesNum: 0,
                highlightSrcTable: false,
                highlightDstTable: false,
                highlightMidTable: false
            });
            // 定义普通数据
            const rawData = {
                // 图谱相关
                graphInstance: null,
                data: null,
                dataWithoutJobNode: null,
                container: 'graph-container',
                selector: 'graph-render',
                legendContainer: 'legend-container',
                width: 0,
                height: 0,
                radius: 0, // 节点半径
            };

            /**
             * 初始化数据集选择列表
             */
            // const initDatasetList = () => {
            //     d3.json('./original_graph_list.json')
            //         .then((data) => {
            //             reactiveData.datasetList = data.map((d) => ({
            //                 value: d,
            //                 label: d,
            //             }));
            //             reactiveData.dataset = data[0];
            //         })
            //         .then(() => {
            //             // 渲染
            //             changeDataset();
            //         });
            // };

            const initDatasetList = () => {
                d3.json('./original_graph_list.json')
                    .then(data => {
                        reactiveData.datasetList = data.map((d) => ({
                            value: d,
                            label: d,
                        }));
                        reactiveData.dataset = data[0];
                    })
                    .then(() => {
                        d3.json('./highlight_list.json')
                            .then(data => {
                                reactiveData.originalHighlightList = data
                            })
                    })
                    .then(
                        () => {
                            // 渲染
                            changeDataset()
                        }
                    )
            };

            /**
             * 初始化图谱相关数据
             */
            const initGraphInfos = () => {
                rawData.graphInstance = null; // 图谱类对象
                rawData.container = 'graph-container'; // 图谱容器
                rawData.selector = 'graph-render'; // 渲染元素
                rawData.legendContainer = 'legend-container'; // 图例渲染容器
                rawData.width = document.querySelector(`#${rawData.container}`).clientWidth; // 画布宽

                rawData.height = document.querySelector(`#${rawData.container}`).clientHeight; // 画布高
                rawData.radius = 7; // 节点半径
            };

            /**
             * 初始化重要数据表
             */
            const initShowlist = () => {

                reactiveData.showList = [
                    // {
                    //     num: 1,
                    //     table_id: 'd57100c7-e4bd-4a2b-8a73-e7696c256639',
                    // },
                    // {
                    //     num: 2,
                    //     table_id: '17a7c56d-0709-440c-a1d7-7688b5370ce2',
                    // },

                ]
            }

            /**
             * 实例化图谱类并渲染
             */
            const createGraph = (props = {}) => {
                rawData.graphInstance = new Graph(Object.assign({
                    container: rawData.container,
                    selector: rawData.selector,
                    legendContainer: rawData.legendContainer,
                    width: rawData.width,
                    height: rawData.height,
                    radius: rawData.radius,
                    data: rawData.data,
                    openRenderAnimation: toRaw(reactiveData.openRenderAnimation),
                    switchDatasetByKey: switchDatasetByKey,
                    highlightSrcTable: toRef(reactiveData, 'highlightSrcTable'),
                    highlightDstTable: toRef(reactiveData, 'highlightDstTable'),
                    highlightMidTable: toRef(reactiveData, 'highlightMidTable'),
                    curHighlightDataset: toRef(reactiveData, 'curHighlightDataset'),
                    showList:toRef(reactiveData,"showList"),
                    showListAdd:showListAdd,
                    showListRemove:showListRemove,
                    inShowList:inShowList
                }, props));
            };


            /**
             * 切换数据集
             */
            const changeDataset = () => {
                // 清除先前绘制的元素
                if (rawData.graphInstance) {
                    rawData.graphInstance.simulation.stop();
                    rawData.graphInstance = null;
                    d3.select(`#${rawData.selector}`).remove();
                    d3.select(`#${rawData.legendContainer} svg`).remove();
                }
                // 恢复过滤设置
                reactiveData.filterMethod = ''; // 所选择的过滤方式
                // reactiveData.filterMethod = 'delete'; // 所选择的过滤方式
                reactiveData.nodeTypeNameList = []; // 节点类型
                reactiveData.nodeFilter = []; // 所选择的节点过滤类型
                reactiveData.edgeTypeNameList = []; // 连边类型
                reactiveData.edgeFilter = []; // 所选择的连边过滤类型
                reactiveData.showList = [];
                if (reactiveData.datasetList.length) {
                    reactiveData.curDatasetIndex = reactiveData.datasetList.findIndex((d) => d.value === reactiveData.dataset);
                }
                d3.json(`./dataset/${reactiveData.dataset}.json`).then((data) => {
                    // 设置数据
                    rawData.data = data;
                    reactiveData.curNodesNum = data.nodes.length;
                    reactiveData.curEdgesNum = data.edges.length;
                    reactiveData.originalGraph.nodeNum = data.nodes.length;
                    reactiveData.originalGraph.edgeNum = data.edges.length;
                    // 设置节点过滤选项
                    reactiveData.nodeTypeNameList = [
                        ...new Set(data.nodes.map((d) => d.typeName)),
                    ].map((d) => ({ value: d, label: d }));
                    // 设置连边过滤选项
                    reactiveData.edgeTypeNameList = [
                        ...new Set(data.edges.map((d) => d.relationshipTypeName)),
                    ].map((d) => ({ value: d, label: d }));
                    // 创建图谱
                    createGraph();
                });
            };
            /**
             * 切换初始化渲染动画
             */
            const switchRenderAnimation = () => {
                // 清除先前绘制的元素
                if (rawData.graphInstance) {
                    rawData.graphInstance.simulation.stop();
                    rawData.graphInstance = null;
                    d3.select(`#${rawData.selector}`).remove();
                    d3.select(`#${rawData.legendContainer} svg`).remove();
                }
                // 创建图谱
                createGraph();
            };

            /**
             * 自动缩放居中
             */
            const autoZoom = () => {
                console.log('自动缩放居中');
            };

            const changeFilter = () => {
                const filterMethod = toRaw(reactiveData.filterMethod);
                if (rawData.graphInstance) {
                    rawData.graphInstance.simulation.stop();
                    rawData.graphInstance = null;
                    d3.select(`#${rawData.selector}`).remove();
                    d3.select(`#${rawData.legendContainer} svg`).remove();
                }

                if (filterMethod === 'hidden') {
                    d3.json(`./dataset/${reactiveData.dataset}.json`).then((data) => {
                        // 设置数据
                        rawData.data = data;
                        reactiveData.curNodesNum = data.nodes.length;
                        reactiveData.curEdgesNum = data.edges.length;
                        reactiveData.originalGraph.nodeNum = data.nodes.length;
                        reactiveData.originalGraph.edgeNum = data.edges.length;
                        // 创建图谱
                        createGraph({
                            hiddenFilterType: {
                                nodeFilter: toRaw(reactiveData.nodeFilter),
                                edgeFilter: toRaw(reactiveData.edgeFilter),
                            },
                        });
                    });
                }

                else if (filterMethod === 'delete') {
                    d3.json(`./dataset/${reactiveData.dataset}.json`).then((data) => {
                        // 设置数据
                        reactiveData.originalGraph.nodeNum = data.nodes.length;
                        reactiveData.originalGraph.edgeNum = data.edges.length;
                        data.nodes = data.nodes.filter((d) => reactiveData.nodeFilter.indexOf(d.typeName) === -1);
                        data.edges = data.edges.filter((d) => reactiveData.edgeFilter.indexOf(d.relationshipTypeName) === -1
                            && reactiveData.nodeFilter.indexOf(d.sourceTypeName) === -1
                            && reactiveData.nodeFilter.indexOf(d.targetTypeName) === -1);
                        rawData.data = data;
                        reactiveData.curNodesNum = data.nodes.length;
                        reactiveData.curEdgesNum = data.edges.length;
                        // 创建图谱
                        createGraph();
                    });
                }
                else {
                    d3.json(`./dataset/${reactiveData.dataset}.json`).then((data) => {
                        // 设置数据
                        rawData.data = data;
                        reactiveData.curNodesNum = data.nodes.length;
                        reactiveData.curEdgesNum = data.edges.length;
                        // 设置节点过滤选项
                        reactiveData.nodeTypeNameList = [
                            ...new Set(data.nodes.map((d) => d.typeName)),
                        ].map((d) => ({ value: d, label: d }));
                        // 设置连边过滤选项
                        reactiveData.edgeTypeNameList = [
                            ...new Set(data.edges.map((d) => d.relationshipTypeName)),
                        ].map((d) => ({ value: d, label: d }));
                        // 创建图谱
                        createGraph();
                    });
                }
            };

            /**
             * 将参数列表保存至本地
             */
            const saveList = () => {
                let newDate = new Date();
                let res = {};
                res.savetime = newDate;
                let tableList = []
                for(var i = 0; i < reactiveData.showList.length; i++)
                    tableList.push(reactiveData.showList[i].table_id)
                res.tableId = tableList
                // 要保存的字符串, 需要先将数据转成字符串
                const stringData = JSON.stringify(res)
                // dada 表示要转换的字符串数据，type 表示要转换的数据格式
                const blob = new Blob([stringData], {
                    type: 'application/json'
                })
                // 根据 blob生成 url链接
                const objectURL = URL.createObjectURL(blob)

                // 创建一个 a 标签Tag
                const aTag = document.createElement('a')
                // 设置文件的下载地址
                aTag.href = objectURL
                // 设置保存后的文件名称
                aTag.download = reactiveData.dataset+"importtable.json"
                // 给 a 标签添加点击事件
                aTag.click()
                // 释放一个之前已经存在的、通过调用 URL.createObjectURL() 创建的 URL 对象。
                // 当你结束使用某个 URL 对象之后，应该通过调用这个方法来让浏览器知道不用在内存中继续保留对这个文件的引用了。
                URL.revokeObjectURL(objectURL)
            }

            /**
             * 根据键盘方向切换数据集
             * @param flag
             */
            function switchDatasetByKey(flag = '') {
                if (flag === 'right' &&
                    reactiveData.curDatasetIndex < reactiveData.datasetList.length - 1) {
                    reactiveData.dataset =
                        reactiveData.datasetList[reactiveData.curDatasetIndex + 1].value;
                    changeDataset();
                }
                if (flag === 'left' && reactiveData.curDatasetIndex > 0) {
                    reactiveData.dataset =
                        reactiveData.datasetList[reactiveData.curDatasetIndex - 1].value;
                    changeDataset();
                }
            }

            /**
             * 添加showList集合元素
             */
            function showListAdd(tableId) {
                var newTable = {}
                newTable.num = reactiveData.showList.length + 1
                newTable.table_id = tableId
                reactiveData.showList.push(newTable)
            }

            /**
             * 判断数据表id是否在showList中
             * @param tableId
             */
            function inShowList(tableId) {
                for(var i = 0; i < reactiveData.showList.length;i++) {
                    var curTable = reactiveData.showList[i];
                    if(curTable.table_id == tableId) {
                        return true;
                    }
                }

                return false;
            }

            /**
             * 移除showList集合元素
             */
            function showListRemove(tableId) {
                for(var i = 0; i < reactiveData.showList.length;i++) {
                    var curTable = reactiveData.showList[i];
                    if(curTable.table_id == tableId) {
                        // 删除指定元素，并将后续元素的num值都减一
                        reactiveData.showList.splice(i,1)
                        while(i < reactiveData.showList.length) {
                            reactiveData.showList[i].num = i + 1;
                            i++;
                        }
                        break;
                    }
                }
            }

            function highlightSrcHandler() {
                reactiveData.highlightSrcTable = !reactiveData.highlightSrcTable
                rawData.graphInstance.renderRefresh()
            }


            function highlightDstHandler() {
                reactiveData.highlightDstTable = !reactiveData.highlightDstTable
                rawData.graphInstance.renderRefresh()
            }


            function highlightMidHandler() {
                reactiveData.highlightMidTable = !reactiveData.highlightMidTable
                rawData.graphInstance.renderRefresh()
            }




            // 初始化
            onMounted(() => {
                // 初始化图谱相关数据
                initGraphInfos();
                // 初始化数据集选择列表并渲染
                initDatasetList();
                //初始化高亮数据表并渲染
                initShowlist();



            });


            // 高亮数据集
            reactiveData.highlightList = computed(() => {
                const pattern = new RegExp(reactiveData.dataset)
                const highlightList = reactiveData.originalHighlightList.filter(fileName => pattern.test(fileName))
                highlightList.unshift('无')
                reactiveData.curHighlightDataset = highlightList[0]
                return highlightList
            })
            // console.log("res:",Object.assign(Object.assign({}, toRefs(reactiveData)), {
            //     // 界面交互方法
            //     changeDataset,
            //     switchRenderAnimation,
            //     autoZoom,
            //     changeFilter,
            //     highlightSrcHandler,
            //     highlightDstHandler,
            //     highlightMidHandler
            // }))


            return Object.assign(Object.assign({}, toRefs(reactiveData), {
                // 界面交互方法
                changeDataset,
                switchRenderAnimation,
                autoZoom,
                changeFilter,
                highlightSrcHandler,
                highlightDstHandler,
                highlightMidHandler,
                saveList
            }));
        },
    });

    app.use(antd);

    // 注册组件
    app.component('show-list', {
        props: ['list'],
        template: `
    <ul>
      <li v-for="item in list" :key="item" @click="selectDataset(item)">
        {{ item }}
      </li>
      <li @click="cancelDataset">取消选择</li>
    </ul>
  `,
        methods: {
            selectDataset(dataset) {
                this.$emit('select-dataset', dataset);
            },
            cancelDataset() {
                this.$emit('cancel-dataset');
            }
        }
    });

    app.mount('#app');
})();
