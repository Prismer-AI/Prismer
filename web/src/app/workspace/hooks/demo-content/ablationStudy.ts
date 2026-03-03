/**
 * Ablation Study — HTML Content for Demo Scenario 3
 *
 * Object detection ablation experiment document.
 * Injected into AI Editor (Notes) via componentStore.
 */

export const ABLATION_STUDY_HTML = `
<h1>目标检测消融实验分析报告</h1>

<h2>1. 实验设置</h2>

<h3>1.1 基础配置</h3>
<ul>
  <li><strong>数据集</strong>: COCO 2017 (118K train / 5K val)</li>
  <li><strong>评估指标</strong>: mAP, AP<sub>50</sub>, AP<sub>75</sub>, AP<sub>S</sub>, AP<sub>M</sub>, AP<sub>L</sub></li>
  <li><strong>训练配置</strong>: SGD, lr=0.01, weight_decay=1e-4, batch_size=16</li>
  <li><strong>训练轮次</strong>: 12 epochs (1x schedule)</li>
  <li><strong>GPU</strong>: 8x NVIDIA A100 80GB</li>
</ul>

<h3>1.2 消融变量</h3>
<table>
  <thead>
    <tr>
      <th>变量</th>
      <th>选项</th>
      <th>默认值</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Backbone</td><td>ResNet-50, ResNet-101, Swin-T, Swin-S</td><td>ResNet-50</td></tr>
    <tr><td>Neck</td><td>FPN, PAFPN, BiFPN, NAS-FPN</td><td>FPN</td></tr>
    <tr><td>Detection Head</td><td>Anchor-based, Anchor-free (FCOS), DETR</td><td>Anchor-based</td></tr>
    <tr><td>数据增强</td><td>None, Mosaic, MixUp, CutOut, Combined</td><td>None</td></tr>
    <tr><td>Loss Function</td><td>Smooth L1, GIoU, DIoU, CIoU</td><td>Smooth L1</td></tr>
    <tr><td>NMS</td><td>Hard NMS, Soft-NMS, DIoU-NMS</td><td>Hard NMS</td></tr>
  </tbody>
</table>

<h2>2. 基线结果</h2>

<p>基线模型: Faster R-CNN + ResNet-50 + FPN, 1x schedule</p>

<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>AP<sub>S</sub></th>
      <th>AP<sub>M</sub></th>
      <th>AP<sub>L</sub></th>
      <th>FPS</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Baseline (R50+FPN)</strong></td><td>37.4</td><td>58.1</td><td>40.4</td><td>21.2</td><td>41.0</td><td>48.1</td><td>24.3</td></tr>
  </tbody>
</table>

<h2>3. 消融实验结果</h2>

<h3>3.1 Backbone 消融</h3>
<p>固定: FPN + Anchor-based Head + No Aug + Smooth L1 + Hard NMS</p>

<table>
  <thead>
    <tr>
      <th>Backbone</th>
      <th>Params (M)</th>
      <th>FLOPs (G)</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>&Delta; mAP</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>ResNet-50</td><td>41.5</td><td>207</td><td>37.4</td><td>58.1</td><td>40.4</td><td>-</td></tr>
    <tr><td>ResNet-101</td><td>60.5</td><td>283</td><td>39.4</td><td>60.1</td><td>43.1</td><td style="color:green"><strong>+2.0</strong></td></tr>
    <tr><td>Swin-T</td><td>47.8</td><td>264</td><td>42.7</td><td>65.2</td><td>46.8</td><td style="color:green"><strong>+5.3</strong></td></tr>
    <tr><td>Swin-S</td><td>69.1</td><td>354</td><td>44.5</td><td>66.1</td><td>48.9</td><td style="color:green"><strong>+7.1</strong></td></tr>
  </tbody>
</table>

<p><strong>分析</strong>: Swin Transformer backbone 带来显著提升 (+5.3~+7.1 mAP)。Swin-T 在参数量与 ResNet-50 相当的情况下，mAP 提升 5.3 个点。Swin-S 进一步提升但代价是增加 45% 的参数量。</p>

<h3>3.2 Neck 消融</h3>
<p>固定: ResNet-50 + Anchor-based Head + No Aug + Smooth L1 + Hard NMS</p>

<table>
  <thead>
    <tr>
      <th>Neck</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>AP<sub>S</sub></th>
      <th>&Delta; mAP</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>FPN</td><td>37.4</td><td>58.1</td><td>40.4</td><td>21.2</td><td>-</td></tr>
    <tr><td>PAFPN</td><td>38.5</td><td>59.3</td><td>41.8</td><td>22.8</td><td style="color:green"><strong>+1.1</strong></td></tr>
    <tr><td>BiFPN</td><td>39.2</td><td>60.5</td><td>42.6</td><td>23.5</td><td style="color:green"><strong>+1.8</strong></td></tr>
    <tr><td>NAS-FPN</td><td>39.5</td><td>60.8</td><td>43.1</td><td>23.2</td><td style="color:green"><strong>+2.1</strong></td></tr>
  </tbody>
</table>

<p><strong>分析</strong>: 特征金字塔升级带来的收益（+1.1~+2.1）小于 backbone 升级。BiFPN 和 NAS-FPN 在小目标检测 (AP<sub>S</sub>) 上有更明显提升。</p>

<h3>3.3 Detection Head 消融</h3>
<p>固定: ResNet-50 + FPN + No Aug + 对应默认 Loss</p>

<table>
  <thead>
    <tr>
      <th>Head</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>FPS</th>
      <th>&Delta; mAP</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Anchor-based (Faster R-CNN)</td><td>37.4</td><td>58.1</td><td>40.4</td><td>24.3</td><td>-</td></tr>
    <tr><td>Anchor-free (FCOS)</td><td>38.7</td><td>57.4</td><td>41.8</td><td>26.1</td><td style="color:green"><strong>+1.3</strong></td></tr>
    <tr><td>DETR</td><td>42.0</td><td>62.4</td><td>44.2</td><td>18.7</td><td style="color:green"><strong>+4.6</strong></td></tr>
  </tbody>
</table>

<p><strong>分析</strong>: DETR 检测精度最高 (+4.6 mAP)，但推理速度下降明显。FCOS 在保持高速度的同时略有提升。</p>

<h3>3.4 数据增强消融</h3>
<p>固定: ResNet-50 + FPN + Anchor-based + Smooth L1 + Hard NMS</p>

<table>
  <thead>
    <tr>
      <th>增强策略</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>&Delta; mAP</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>None</td><td>37.4</td><td>58.1</td><td>40.4</td><td>-</td></tr>
    <tr><td>Mosaic</td><td>39.1</td><td>59.8</td><td>42.3</td><td style="color:green"><strong>+1.7</strong></td></tr>
    <tr><td>MixUp</td><td>38.2</td><td>58.9</td><td>41.5</td><td style="color:green"><strong>+0.8</strong></td></tr>
    <tr><td>CutOut</td><td>37.9</td><td>58.7</td><td>41.0</td><td style="color:green"><strong>+0.5</strong></td></tr>
    <tr><td>Combined (Mosaic+MixUp)</td><td>40.3</td><td>61.2</td><td>43.7</td><td style="color:green"><strong>+2.9</strong></td></tr>
  </tbody>
</table>

<p><strong>分析</strong>: 组合数据增强效果最佳 (+2.9 mAP)。Mosaic 增强对目标检测最有效 (+1.7)，MixUp 次之。</p>

<h3>3.5 Loss Function 消融</h3>
<p>固定: ResNet-50 + FPN + Anchor-based + No Aug + Hard NMS</p>

<table>
  <thead>
    <tr>
      <th>Loss</th>
      <th>mAP</th>
      <th>AP<sub>75</sub></th>
      <th>&Delta; mAP</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Smooth L1</td><td>37.4</td><td>40.4</td><td>-</td></tr>
    <tr><td>GIoU</td><td>38.3</td><td>41.5</td><td style="color:green"><strong>+0.9</strong></td></tr>
    <tr><td>DIoU</td><td>38.5</td><td>41.8</td><td style="color:green"><strong>+1.1</strong></td></tr>
    <tr><td>CIoU</td><td>38.8</td><td>42.2</td><td style="color:green"><strong>+1.4</strong></td></tr>
  </tbody>
</table>

<p><strong>分析</strong>: IoU 系列损失函数在高精度检测 (AP<sub>75</sub>) 上优势更明显。CIoU 综合考虑重叠面积、中心距离和长宽比，效果最佳。</p>

<h2>4. 最优组合</h2>

<p>基于消融实验结果，组合各维度最优配置：</p>

<table>
  <thead>
    <tr>
      <th>配置</th>
      <th>mAP</th>
      <th>AP<sub>50</sub></th>
      <th>AP<sub>75</sub></th>
      <th>AP<sub>S</sub></th>
      <th>AP<sub>M</sub></th>
      <th>AP<sub>L</sub></th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Baseline</td><td>37.4</td><td>58.1</td><td>40.4</td><td>21.2</td><td>41.0</td><td>48.1</td></tr>
    <tr><td><strong>Best Combo</strong><br/>(Swin-S + BiFPN + CIoU + Combined Aug)</td><td><strong>48.7</strong></td><td><strong>69.3</strong></td><td><strong>53.2</strong></td><td><strong>31.5</strong></td><td><strong>52.4</strong></td><td><strong>62.8</strong></td></tr>
    <tr><td colspan="7" style="text-align:center; color:green"><strong>&Delta; Total: +11.3 mAP</strong></td></tr>
  </tbody>
</table>

<h2>5. 结论</h2>

<ol>
  <li><strong>Backbone 影响最大</strong>: Swin Transformer backbone 贡献了最大的性能提升 (+5.3~+7.1 mAP)，是最值得投资的升级方向</li>
  <li><strong>数据增强成本效益最高</strong>: 组合增强策略 (+2.9 mAP) 零额外推理开销，应作为默认训练配置</li>
  <li><strong>Neck 和 Loss 提升稳定</strong>: BiFPN (+1.8) 和 CIoU (+1.4) 均带来一致性提升</li>
  <li><strong>DETR Head 精度最高但速度下降</strong>: 需根据部署场景权衡 accuracy vs latency</li>
  <li><strong>各项改进近似正交</strong>: 最优组合 (48.7 mAP) 接近各项独立提升之和 (baseline 37.4 + 7.1 + 1.8 + 1.4 + 2.9 = 50.6)，实际有轻微正交损失</li>
</ol>

<hr/>
<p><em>Generated by Prismer.AI Research Agent | COCO 2017 benchmark</em></p>
`;
