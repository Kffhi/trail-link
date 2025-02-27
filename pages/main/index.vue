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
            @regionchange="onMapRegionChange"
            @markertap="onMarkerTap"
        ></map>
        
        <!-- 定位按钮 -->
        <view class="locate-btn" @tap="relocate">
            <image src="@/static/image/location.png" class="location-icon"></image>
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
            searchKeyword: '',
        }
    },
    onLoad() {
        // 创建高德地图实例
        this.amapPlugin = new AMapWX({
            key: 'd9189d738671faac92d533c0f44ea14c'
        });
        
        // 显示加载状态
        uni.showLoading({
            title: '正在定位...'
        });
        
        // 先初始化地图上下文
        this.mapContext = uni.createMapContext('map', this);
        
        // 获取当前位置
        this.getLocation();
    },
    methods: {
        // 获取当前位置
        getLocation() {
            uni.getLocation({
                type: 'gcj02',
                isHighAccuracy: true,
                highAccuracyExpireTime: 5000, // 增加超时时间
                success: (res) => {
                    console.log('获取位置成功:', res);
                    
                    // 更新数据
                    this.longitude = res.longitude;
                    this.latitude = res.latitude;
                    
                    // 延迟一下再移动地图到当前位置，确保视图已更新
                    setTimeout(() => {
                        // 主动调用方法移动地图到当前位置
                        this.mapContext.moveToLocation({
                            longitude: res.longitude,
                            latitude: res.latitude,
                            success: () => {
                                console.log('地图已移动到当前位置');
                            },
                            fail: (err) => {
                                console.error('移动地图失败:', err);
                            },
                            complete: () => {
                                uni.hideLoading();
                            }
                        });
                    }, 300);
                },
                fail: (err) => {
                    console.error('获取位置失败:', err);
                    uni.showToast({
                        title: '获取位置失败，使用默认位置',
                        icon: 'none'
                    });
                    uni.hideLoading();
                }
            });
        },
        
        // 处理搜索
        handleSearch(e) {
            const keyword = e.detail.value || this.searchKeyword;
            console.log("搜索内容:", keyword);
            
            if (!keyword) return;
            
            // 显示加载状态
            uni.showLoading({
                title: '搜索中...'
            });
            
            // 修改为使用getInputtips API进行全国范围搜索
            this.amapPlugin.getInputtips({
                keywords: keyword,
                location: `${this.longitude},${this.latitude}`, // 仍然提供当前位置作为参考
                city: '', // 空字符串表示全国范围搜索
                citylimit: false, // 不限制在当前城市
                success: (data) => {
                    console.log('搜索结果:', data);
                    uni.hideLoading();
                    
                    if (data && data.tips && data.tips.length > 0) {
                        // 过滤出有位置信息的提示项
                        const validTips = data.tips.filter(tip => tip.location);
                        
                        if (validTips.length > 0) {
                            // 转换为markers
                            const newMarkers = validTips.map((tip, index) => {
                                // 提取位置信息
                                const locationParts = tip.location.split(',');
                                if (locationParts.length !== 2) return null;
                                
                                const longitude = parseFloat(locationParts[0]);
                                const latitude = parseFloat(locationParts[1]);
                                
                                if (isNaN(longitude) || isNaN(latitude)) return null;
                                
                                return {
                                    id: index + 1,
                                    latitude: latitude,
                                    longitude: longitude,
                                    title: tip.name || tip.district,
                                    iconPath: '../../static/image/marker.png',
                                    width: 32,
                                    height: 32,
                                    label: {
                                        content: tip.name || tip.district,
                                        color: '#333333',
                                        fontSize: 11,
                                        bgColor: 'rgba(255, 255, 255, 0.8)',
                                        padding: 3,
                                        borderRadius: 3,
                                        borderWidth: 1,
                                        borderColor: '#dddddd',
                                        textAlign: 'center',
                                        anchorX: 16,
                                        anchorY: -55
                                    },
                                    callout: {
                                        content: `${tip.name || tip.district}\n${tip.address || tip.district}`,
                                        color: '#000000',
                                        fontSize: 12,
                                        borderRadius: 8,
                                        padding: 10,
                                        bgColor: '#ffffff',
                                        display: 'BYCLICK',
                                        textAlign: 'left'
                                    }
                                };
                            }).filter(marker => marker !== null);
                            
                            this.markers = newMarkers;
                            
                            // 将地图移动到第一个搜索结果
                            if (newMarkers.length > 0) {
                                this.longitude = newMarkers[0].longitude;
                                this.latitude = newMarkers[0].latitude;
                                this.scale = 14; // 稍微缩小比例尺，显示更大范围
                            }
                            
                            uni.showToast({
                                title: `找到${newMarkers.length}个地点`,
                                icon: 'none'
                            });
                        } else {
                            // 如果没有有效位置信息，尝试使用POI搜索
                            this.searchWithPoi(keyword);
                        }
                    } else {
                        // 回退到POI搜索
                        this.searchWithPoi(keyword);
                    }
                },
                fail: (err) => {
                    console.error('搜索失败:', err);
                    uni.hideLoading();
                    // 回退到POI搜索
                    this.searchWithPoi(keyword);
                }
            });
        },
        
        // 添加POI搜索方法作为备选方案
        searchWithPoi(keyword) {
            uni.showLoading({
                title: '继续搜索...'
            });
            
            // 使用POI搜索API
            this.amapPlugin.getPoiAround({
                keywords: keyword,
                location: `${this.longitude},${this.latitude}`,
                success: (data) => {
                    uni.hideLoading();
                    console.log('POI搜索结果:', data);
                    
                    if (data && data.poisData && data.poisData.length > 0) {
                        // 处理POI搜索结果的代码与之前相同
                        const newMarkers = data.poisData.map((poi, index) => {
                            if (!poi.location) return null;
                            
                            const locationParts = poi.location.split(',');
                            if (locationParts.length !== 2) return null;
                            
                            const longitude = parseFloat(locationParts[0]);
                            const latitude = parseFloat(locationParts[1]);
                            
                            if (isNaN(latitude) || isNaN(longitude)) return null;
                            
                            return {
                                id: index + 1,
                                latitude: latitude,
                                longitude: longitude,
                                title: poi.name,
                                iconPath: '../../static/image/marker.png',
                                width: 32,
                                height: 32,
                                label: {
                                    content: poi.name,
                                    color: '#333333',
                                    fontSize: 11,
                                    bgColor: 'rgba(255, 255, 255, 0.8)',
                                    padding: 3,
                                    borderRadius: 3,
                                    borderWidth: 1,
                                    borderColor: '#dddddd',
                                    textAlign: 'center',
                                    anchorX: 16,
                                    anchorY: -55
                                },
                                callout: {
                                    content: `${poi.name}\n${poi.biz_ext?.rating ? '评分: ' + poi.biz_ext.rating + '分' : ''}\n${poi.address ? '地址: ' + poi.address : ''}\n${poi.tel ? '电话: ' + poi.tel : ''}`,
                                    color: '#000000',
                                    fontSize: 12,
                                    borderRadius: 8,
                                    padding: 10,
                                    bgColor: '#ffffff',
                                    display: 'BYCLICK',
                                    textAlign: 'left'
                                }
                            };
                        }).filter(marker => marker !== null);
                        
                        this.markers = newMarkers;
                        
                        if (newMarkers.length > 0) {
                            this.longitude = newMarkers[0].longitude;
                            this.latitude = newMarkers[0].latitude;
                            this.scale = 14;
                        }
                        
                        uni.showToast({
                            title: `找到${newMarkers.length}个地点`,
                            icon: 'none'
                        });
                    } else {
                        this.markers = [];
                        uni.showToast({
                            title: '未找到相关地点',
                            icon: 'none'
                        });
                    }
                },
                fail: (err) => {
                    uni.hideLoading();
                    console.error('POI搜索失败:', err);
                    uni.showToast({
                        title: '搜索失败，请重试',
                        icon: 'none'
                    });
                }
            });
        },
        
        // 地图区域变化事件
        onMapRegionChange(e) {
            if (e.type === 'end' && e.causedBy === 'drag') {
                // 用户拖动地图结束后，可以在这里更新当前位置
                this.mapContext.getCenterLocation({
                    success: (res) => {
                        this.longitude = res.longitude;
                        this.latitude = res.latitude;
                    }
                });
            }
        },
        
        // 点击标记点事件
        onMarkerTap(e) {
            const markerId = e.markerId;
            const marker = this.markers.find(m => m.id === markerId);
            
            if (marker) {
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
                                    // 处理导航数据
                                    console.log('导航数据:', data);
                                    // 这里可以绘制路线等
                                }
                            });
                        }
                    }
                });
            }
        },
        
        // 添加重新定位方法
        relocate() {
            uni.showLoading({
                title: '正在定位...'
            });
            
            // 调用微信的获取位置API
            uni.getLocation({
                type: 'gcj02',
                isHighAccuracy: true,
                success: (res) => {
                    // 更新位置
                    this.longitude = res.longitude;
                    this.latitude = res.latitude;
                    
                    // 移动地图
                    this.mapContext.moveToLocation({
                        longitude: res.longitude,
                        latitude: res.latitude,
                        complete: () => {
                            uni.hideLoading();
                        }
                    });
                    
                    // 重置缩放级别
                    this.scale = 15;
                },
                fail: (err) => {
                    console.error('重新定位失败:', err);
                    uni.showToast({
                        title: '定位失败，请检查定位权限',
                        icon: 'none'
                    });
                    uni.hideLoading();
                }
            });
        }
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
