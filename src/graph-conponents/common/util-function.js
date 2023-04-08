import { nodeInfoConfig } from './static-const-value.js';
/**
 * 在指定容器里绘制图例
 * @param containerElementID 绘制容器id (不带#)
 * @param legendList 图例数组
 */
const renderLegend = (containerElementID, legendList, legendRenderParams = {
    size: 8,
    heightPadding: 2,
}) => {
    const containerEL = d3.select(`#${containerElementID}`);
    // 初始化容器
    containerEL.select('svg#legend-svg').remove();
    const legendSvg = containerEL
        .append('svg')
        .attr('id', 'legend-svg')
        .attr('height', (legendRenderParams.size * 2 + legendRenderParams.heightPadding) *
        legendList.length -
        legendRenderParams.heightPadding);
    // 对图标按权重进行排序
    legendList.sort((a, b) => {
        const w1 = nodeInfoConfig[a.typeName].iconWeight;
        const w2 = nodeInfoConfig[b.typeName].iconWeight;
        return w1 - w2;
    });
    // 绘制图标
    legendSvg
        .selectAll('circle')
        .data(legendList)
        .enter()
        .append('circle')
        .attr('class', 'legend-circle')
        .attr('id', (d) => `legend-circle-${d.typeName}`)
        .attr('cx', legendRenderParams.size * 2)
        .attr('cy', (d, index) => legendRenderParams.size +
        (legendRenderParams.size * 2 + legendRenderParams.heightPadding) * index)
        .attr('r', legendRenderParams.size)
        .attr('fill', function (d) {
        const cx = parseInt(d3.select(this).attr('cx'));
        const cy = parseInt(d3.select(this).attr('cy'));
        // // 设置图标中心内容
        // legendSvg
        //     .append('text')
        //     .style('font-size', '12px')
        //     .style('fill', '#ffffff')
        //     .attr('x', cx)
        //     .attr('y', cy)
        //     .attr('transform', `translate(0,${legendRenderParams.size / 2})`)
        //     .attr('pointer-events', 'none')
        //     .style('text-anchor', 'middle')
        //     .style('cursor', 'default')
        //     .style('fill', '#000000')
        //     .text(nodeInfoConfig[d.typeName].iconLabel);
        // 设置文本内容
        legendSvg
            .append('text')
            .attr('x', cx)
            .attr('y', cy)
            .attr('transform', `translate(${legendRenderParams.size * 2},${legendRenderParams.size / 2})`)
            .attr('pointer-events', 'none')
            .style('cursor', 'default')
            .style('fill', '#000000')
            .text(`${nodeInfoConfig[d.typeName].chineseName}`);
            // 不加数量
            // .text(`${nodeInfoConfig[d.typeName].chineseName} ${d.num}`);
        // 数据表节点有多个可能的颜色，选择中间颜色
        if(d.typeName == 'dli.Table')   return nodeInfoConfig[d.typeName].color.c3;
        return nodeInfoConfig[d.typeName].color;
    });

    //如果已添加先删除
    containerEL.select('.blue-img-split').remove();
    containerEL.select('.blue-img').remove();

    // 添加蓝色分布图
    containerEL.append('hr')
        .attr('class','blue-img-split')
    containerEL.append('img')
        .attr("class","blue-img")
        .attr('src','../static/blue.png')
        .attr('alt','blue img fail')
        .attr("width","190px");
};
export { renderLegend };
