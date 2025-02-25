<template>
    <view class="container">
        <!-- 地图容器 -->
        <map
            id="myMap"
            class="map-container"
            :longitude="longitude"
            :latitude="latitude"
            :scale="scale"
            :enable-zoom="true"
            :enable-scroll="true"
            :enable-rotate="false"
            :show-compass="true"
            :show-scale="true"
            :enable-traffic="true"
            :enable-poi="true"
            :enable-building="true"
            subkey="PEPBZ-XMX6Q-VZC5A-2DECB-QT5YH-GTF3E"
            :show-location="true"
            binderror="onMapError"
        ></map>
        <!-- 底部搜索框 -->
        <view class="search-container safe-area">
            <input
                class="search-input"
                placeholder="请输入目的地"
                placeholder-class="placeholder-style"
                @confirm="handleSearch"
            />
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            longitude: 120.148306, // 杭州断桥经度
            latitude: 30.262875,   // 杭州断桥纬度
            scale: 15,
        }
    },
    onLoad() {
        this.getLocation()
    },
    methods: {
        // 获取当前位置
        async getLocation() {
            try {
                const res = await uni.getLocation({ type: "gcj02" })
                this.longitude = res.longitude
                this.latitude = res.latitude
            } catch (error) {
                // 定位失败时使用默认杭州断桥坐标
                this.longitude = 120.148306
                this.latitude = 30.262875
                uni.showToast({
                    title: "获取位置失败",
                    icon: "none",
                })
            }
        },

        // 搜索处理
        handleSearch(e) {
            console.log("搜索内容:", e.detail.value)
            // 这里可以添加地图搜索逻辑
        },

        // 重新定位
        handleLocate() {
            this.getLocation()
        },

        onMapError(e) {
            console.error('地图加载失败:', e.detail);
            uni.showToast({
                title: '地图加载失败，请检查网络',
                icon: 'none'
            });
        },
    },
}
</script>

<style scoped lang="scss">
.container {
    height: 100vh;
    position: relative;

    .map-container {
        width: 100%;
        height: 100%;
    }

    .search-container {
        position: fixed;
        bottom: 24px;
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
}
</style>
