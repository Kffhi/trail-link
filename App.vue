<script>
export default {
    onLaunch: function () {
        wx.cloud.init({
            env: "imgs-3g2zmlagfdfa109d",
            traceUser: true,
        })
        console.log("App Launch")
    },
    onShow: function () {
        console.log("App Show")
    },
    onHide: function () {
        console.log("App Hide")
    },
}
</script>

<style lang="scss">
/*每个页面公共css */
@import "@/uni_modules/uni-scss/index.scss";
/* #ifndef APP-NVUE */
@import "@/static/style/customicons.css";
// 设置整个项目的背景色
page {
    background-color: #f5f5f5;
}

div,
view {
    box-sizing: border-box;
}
</style>
