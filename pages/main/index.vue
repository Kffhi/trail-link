<template>
    <view class="container">
        <!-- 顶部搜索框 -->
        <view class="search-container safe-area">
            <input
                class="search-input"
                placeholder="请输入目的地"
                placeholder-class="placeholder-style"
                @confirm="handleSearch"
                v-model="searchKeyword"
            />
        </view>

        <!-- 地图容器 -->
        <map
            class="map"
            id="map"
            :longitude="longitude"
            :latitude="latitude"
            :scale="scale"
            :markers="markers"
            :show-location="true"
            :enable-poi="true"
            :enable-building="true"
            :enable-3D="true"
            :enable-overlooking="true"
            :enable-satellite="false"
            :enable-traffic="false"
            :enable-rotate="false"
            :enable-over-look="false"
            :enable-over-look-rotate="false"
            :enable-auto-max-adaption="true"
            :enable-marker-cluster="enableCluster"
            @regionchange="onMapRegionChange"
            @markertap="onMarkerTap"
        ></map>

        <!-- 定位按钮 -->
        <view class="locate-btn" @tap="relocate">
            <image
                src="@/static/image/location.png"
                class="location-icon"
            ></image>
        </view>
    </view>
</template>

<script>
import AMapWX from "../../utils/amap-wx.js"

export default {
    data() {
        return {
            longitude: 120.148306,
            latitude: 30.262875,
            scale: 15,
            mapContext: null,
            markers: [],
            amapPlugin: null,
            searchKeyword: "",
            markerIconPath: "../../static/image/marker.png",
            activeMarkerIconPath: "../../static/image/marker_active.png",
            enableCluster: true, // 启用标记点聚合
        }
    },
    onLoad() {
        // 创建高德地图实例
        this.amapPlugin = new AMapWX({
            key: "d9189d738671faac92d533c0f44ea14c",
        })

        // 显示加载状态
        uni.showLoading({
            title: "正在定位...",
        })

        // 先初始化地图上下文
        this.mapContext = uni.createMapContext("map", this)

        // 获取当前位置
        this.getLocation()
    },
    methods: {
        // 获取当前位置
        getLocation() {
            uni.getLocation({
                type: "gcj02",
                isHighAccuracy: true,
                highAccuracyExpireTime: 5000, // 增加超时时间
                success: (res) => {
                    console.log("获取位置成功:", res)

                    // 更新数据
                    this.longitude = res.longitude
                    this.latitude = res.latitude

                    // 延迟一下再移动地图到当前位置，确保视图已更新
                    setTimeout(() => {
                        // 主动调用方法移动地图到当前位置
                        this.mapContext.moveToLocation({
                            longitude: res.longitude,
                            latitude: res.latitude,
                            success: () => {
                                console.log("地图已移动到当前位置")
                            },
                            fail: (err) => {
                                console.error("移动地图失败:", err)
                            },
                            complete: () => {
                                uni.hideLoading()
                            },
                        })
                    }, 300)
                },
                fail: (err) => {
                    console.error("获取位置失败:", err)
                    uni.showToast({
                        title: "获取位置失败，使用默认位置",
                        icon: "none",
                    })
                    uni.hideLoading()
                },
            })
        },

        // 处理搜索
        handleSearch(e) {
            const keyword = e.detail.value || this.searchKeyword
            console.log("搜索内容:", keyword)

            if (!keyword) return

            // 显示加载状态
            uni.showLoading({
                title: "搜索中...",
            })

            // 修改为使用getInputtips API进行全国范围搜索
            this.amapPlugin.getInputtips({
                keywords: keyword,
                location: `${this.longitude},${this.latitude}`, // 仍然提供当前位置作为参考
                city: "", // 空字符串表示全国范围搜索
                citylimit: false, // 不限制在当前城市
                success: (data) => {
                    console.log("搜索结果:", data)
                    uni.hideLoading()

                    if (data && data.tips && data.tips.length > 0) {
                        // 过滤出有位置信息的提示项
                        const validTips = data.tips.filter(
                            (tip) => tip.location
                        )

                        if (validTips.length > 0) {
                            // 转换为markers
                            const newMarkers = this.createMarkersFromData(validTips, 'tips');

                            if (newMarkers.length > 0) {
                                this.updateMapWithSearchResults(newMarkers);
                            } else {
                                // 没有有效标记点，尝试POI搜索
                                this.searchWithPoi(keyword);
                            }
                        } else {
                            // 如果没有有效位置信息，尝试使用POI搜索
                            this.searchWithPoi(keyword)
                        }
                    } else {
                        // 回退到POI搜索
                        this.searchWithPoi(keyword)
                    }
                },
                fail: (err) => {
                    console.error("搜索失败:", err)
                    uni.hideLoading()
                    // 回退到POI搜索
                    this.searchWithPoi(keyword)
                },
            })
        },

        // 添加POI搜索方法作为备选方案
        searchWithPoi(keyword) {
            uni.showLoading({
                title: "继续搜索...",
            })

            // 使用POI搜索API
            this.amapPlugin.getPoiAround({
                keywords: keyword,
                location: `${this.longitude},${this.latitude}`,
                success: (data) => {
                    uni.hideLoading()
                    console.log("POI搜索结果:", data)

                    if (data && data.poisData && data.poisData.length > 0) {
                        // 使用通用方法创建标记点
                        const newMarkers = this.createMarkersFromData(data.poisData, 'poi');
                        this.updateMapWithSearchResults(newMarkers);
                    } else {
                        this.markers = []
                        uni.showToast({
                            title: "未找到相关地点",
                            icon: "none",
                        })
                    }
                },
                fail: (err) => {
                    uni.hideLoading()
                    console.error("POI搜索失败:", err)
                    uni.showToast({
                        title: "搜索失败，请重试",
                        icon: "none",
                    })
                },
            })
        },
        
        // 新增：从搜索数据创建标记点的通用方法
        createMarkersFromData(dataItems, type) {
            return dataItems
                .map((item, index) => {
                    // 根据数据类型提取位置信息
                    if (!item.location) return null;
                    
                    const locationParts = item.location.split(",");
                    if (locationParts.length !== 2) return null;
                    
                    const longitude = parseFloat(locationParts[0]);
                    const latitude = parseFloat(locationParts[1]);
                    
                    if (isNaN(longitude) || isNaN(latitude)) return null;
                    
                    // 根据数据类型处理标题和内容
                    let title, calloutContent;
                    
                    if (type === 'tips') {
                        title = item.name || item.district;
                        calloutContent = `${item.name || item.district}\n${item.address || item.district}`;
                    } else if (type === 'poi') {
                        title = item.name;
                        calloutContent = `${item.name}\n${
                            item.biz_ext?.rating ? "评分: " + item.biz_ext.rating + "分" : ""
                        }\n${
                            item.address ? "地址: " + item.address : ""
                        }\n${
                            item.tel ? "电话: " + item.tel : ""
                        }`;
                    }
                    
                    return {
                        id: index + 1,
                        latitude: latitude,
                        longitude: longitude,
                        title: title,
                        iconPath: "../../static/image/marker.png",
                        width: 30,
                        height: 30,
                        label: {
                            content: title,
                            color: '#333333',
                            fontSize: 12,
                            bgColor: '#ffffff',
                            padding: 3,
                            borderRadius: 3,
                            borderWidth: 1,
                            borderColor: '#e0e0e0',
                            textAlign: 'center',
                            anchorX: -15,
                            anchorY: -52
                        },
                        callout: {
                            content: calloutContent,
                            color: "#000000",
                            fontSize: 12,
                            borderRadius: 6,
                            padding: 8,
                            bgColor: "#ffffff",
                            display: "BYCLICK",
                            textAlign: "left",
                        },
                    };
                })
                .filter((marker) => marker !== null);
        },
        
        // 新增：更新地图显示搜索结果
        updateMapWithSearchResults(markers) {
            if (markers.length > 0) {
                this.markers = this.processMarkers(markers);
                
                // 将地图移动到第一个搜索结果
                this.longitude = markers[0].longitude;
                this.latitude = markers[0].latitude;
                this.scale = 14; // 稍微缩小比例尺，显示更大范围
                
                uni.showToast({
                    title: `找到${markers.length}个地点`,
                    icon: "none",
                });
            } else {
                this.markers = [];
                uni.showToast({
                    title: "未找到相关地点",
                    icon: "none",
                });
            }
        },

        // 地图区域变化事件
        onMapRegionChange(e) {
            if (e.type === "end") {
                if (e.causedBy === "drag") {
                    // 用户拖动地图结束后，可以在这里更新当前位置
                    this.mapContext.getCenterLocation({
                        success: (res) => {
                            this.longitude = res.longitude
                            this.latitude = res.latitude
                        },
                    })
                } else if (e.causedBy === "scale") {
                    // 缩放后更新缩放级别
                    this.mapContext.getScale({
                        success: (res) => {
                            const newScale = res.scale
                            this.scale = newScale

                            // 根据缩放级别更新标记点标签
                            if (this.markers.length > 0) {
                                this.markers = this.processMarkers(this.markers)
                            }
                        },
                    })
                }
            }
        },

        // 点击标记点事件
        onMarkerTap(e) {
            const markerId = e.markerId;
            const marker = this.markers.find(m => m.id === markerId);
            
            if (marker) {
                // 只显示信息窗口，不进行特殊效果处理
                uni.showModal({
                    title: marker.title,
                    content: `是否导航到${marker.title}？`,
                    success: (res) => {
                        if (res.confirm) {
                            // 使用高德地图导航
                            this.amapPlugin.getWalkingRoute({
                                origin: `${this.longitude},${this.latitude}`,
                                destination: `${marker.longitude},${marker.latitude}`,
                                success: (data) => {
                                    console.log("导航数据:", data)
                                    // 这里可以绘制路线等
                                }
                            })
                        }
                    }
                });
            }
        },

        // 添加重新定位方法
        relocate() {
            uni.showLoading({
                title: "正在定位...",
            })

            // 调用微信的获取位置API
            uni.getLocation({
                type: "gcj02",
                isHighAccuracy: true,
                success: (res) => {
                    // 更新位置
                    this.longitude = res.longitude
                    this.latitude = res.latitude

                    // 移动地图
                    this.mapContext.moveToLocation({
                        longitude: res.longitude,
                        latitude: res.latitude,
                        complete: () => {
                            uni.hideLoading()
                        },
                    })

                    // 重置缩放级别
                    this.scale = 15
                },
                fail: (err) => {
                    console.error("重新定位失败:", err)
                    uni.showToast({
                        title: "定位失败，请检查定位权限",
                        icon: "none",
                    })
                    uni.hideLoading()
                },
            })
        },

        // 处理标记点智能显示
        processMarkers(markers) {
            // 处理标记点重叠问题
            const processedMarkers = [...markers];
            const positions = {};
            
            // 遍历所有标记点，检测位置接近的点
            for (let i = 0; i < processedMarkers.length; i++) {
                const marker = processedMarkers[i];
                if (!marker.label) continue;
                
                // 使用更高精度的位置检测
                const pos = `${marker.latitude.toFixed(5)},${marker.longitude.toFixed(5)}`;
                
                if (positions[pos]) {
                    // 位置重叠的标记点，调整标签位置错开显示
                    processedMarkers[i] = {
                        ...marker,
                        label: {
                            ...marker.label,
                            anchorY: -65,
                        }
                    };
                } else {
                    positions[pos] = true;
                }
            }
            
            return processedMarkers;
        },

        // 辅助方法：根据文本长度自适应标签宽度和内容
        formatLabelText(text) {
            if (!text) return '';
            
            // 简化文本处理逻辑
            if (text.length <= 10) {
                return text;
            } else {
                return text.slice(0, 10) + '...';
            }
        },
    },
}
</script>

<style scoped lang="scss">
.container {
    height: 100vh;
    position: relative;

    .map {
        width: 100%;
        height: 100%;
    }

    .search-container {
        position: fixed;
        top: 24px;
        left: 20px;
        right: 20px;
        display: flex;
        gap: 10px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 25px;
        padding: 8px 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        min-height: 44px;
        z-index: 100;

        .search-input {
            flex: 1;
            height: 36px;
            font-size: 16px;
            color: #2d3436;
            padding: 0 12px;
            background: transparent;
            transition: all 0.3s ease;
            border-radius: 18px;

            &::placeholder {
                color: #a4b0be;
                font-weight: 300;
            }

            &:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(77, 89, 244, 0.2);
            }
        }
    }

    .locate-btn {
        position: fixed;
        right: 20px;
        bottom: 40px;
        width: 44px;
        height: 44px;
        background: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 100;

        .location-icon {
            width: 24px;
            height: 24px;
        }
    }
}
</style>
