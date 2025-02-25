export const getTagList = (item) => {
    if (item.category === 'beer' || item.category === 'can') {
        let tagList = []
        if (item.place) {
            tagList.push({
                label: item.place,
                type: 'place'
            })
        }
        if (item.style) {
            tagList.push({
                label: item.style,
                type: 'style'
            })
        }
        if (item.abv) {
            tagList.push({
                label: `ABV ${item.abv}`,
                type: 'abv'
            })
        }
        if (item.ibu) {
            tagList.push({
                label: `IBU ${item.ibu}`,
                type: 'ibu'
            })
        }
        item.usp?.forEach(i => {
            tagList.push({
                label: i,
                type: 'usp'
            })
        })
        item.tagList = tagList
        if (item.category === 'beer') {
            let showName = `NO.${item.order > 9 ? '0' : ''}${item.order}`
            if (item.brand) {
                showName += ' · ' + item.brand
            }
            if (item.name) {
                showName += ' · ' + item.name
            }
            item.showName = showName
        } else {
            let showName = ''
            if (item.brand) {
                showName += item.brand
            }
            if (item.name) {
                showName += ' · ' + item.name
            }
            item.showName = showName
        }
    } else {
        item.tagList = item.usp ?? []
        item.showName = item.name
    }
}

export const getAll = () => {
    return new Promise(async (resolve, reject) => {
        const db = wx.cloud.database()
        const goodDB = db.collection("goods")


        const MAX_LIMIT = 20
        // 先取出集合记录总数
        const countResult = await goodDB.count()
        const total = countResult.total
        // 计算需分几次取
        const batchTimes = Math.ceil(total / MAX_LIMIT)
        // 承载所有读操作的 promise 的数组
        const tasks = []
        for (let i = 0; i < batchTimes; i++) {
            const promise = goodDB.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
            tasks.push(promise)
        }
        // 等待所有
        Promise.all(tasks).then(res => {
            const _res = res.reduce((acc, cur) => {
                return {
                    data: acc.data.concat(cur.data),
                    errMsg: acc.errMsg,
                }
            })
            const data = _res.data
            data.forEach(item => {
                getTagList(item)
            })
            data.sort((a, b) => {
                const priority = ['beer', 'can', 'food', 'drink'];
                let indexA = priority.indexOf(a.category);
                let indexB = priority.indexOf(b.category);
                if (indexA !== indexB) return indexA - indexB;
                let hideA = a.hide === undefined ? false : a.hide;
                let hideB = b.hide === undefined ? false : b.hide;
                if (hideA && !hideB) {
                    return 1;
                } else if (!hideA && hideB) {
                    return -1;
                }
                return a.order - b.order;
            })
            resolve(data)
        }).catch(() => {
            reject('查询出错')
        })
    })
}

export const getDetail = (id) => {
    console.log('id', id)
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const goodDB = db.collection("goods")
        goodDB.where({
            _id: id
        }).get().then(res => {
            console.log('detail', res.data)
            const data = res.data[0]
            getTagList(data)
            resolve(data)
        }).catch(() => {
            reject('查询出错')
        })
    })
}

export const addItem = (params) => {
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const goodDB = db.collection("goods")
        goodDB.add({
            data: params
        }).then(res => {
            resolve(res)
        }).catch(() => {
            reject('添加出错')
        })
    })
}

export const removeItem = (data) => {
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const goodDB = db.collection("goods")
        if (data.category === 'beer') {
            goodDB.doc(data._id).update({
                data: {
                    hide: !data.hide,
                }
            }).then(res => {
                resolve(res)
            }).catch(() => {
                reject('下架出错')
            })
        } else {
            goodDB.doc(data._id).remove().then(res => {
                resolve(res)
            }).catch(() => {
                reject('删除出错')
            })
        }

    })
}

export const replaceItem = (_data) => {
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const goodDB = db.collection("goods")
        const data = JSON.parse(JSON.stringify(_data))
        const id = data._id
        delete data._id
        delete data._openid
        goodDB.doc(id).update({
            data
        }).then(res => {
            resolve(res)
        }).catch(() => {
            reject('更新出错')
        })
    })
}

export const getUrl = (link) => {
    if (!link) {
        return ""
    }
    if (link.substring(0, 5) !== "cloud") {
        return link
    }
    const arr = link.split("/")
    arr[0] = "https:"
    arr[2] = arr[2].split(".")[1] + ".tcb.qcloud.la"
    return arr.join("/")
}

export const getPoster = (type) => {
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const posterDB = db.collection("posters")
        const arr = type ? [type] : ['movie', 'activity']
        posterDB.where({
            type: db.command.in(arr)
        }).get().then(res => {
            const data = res.data
            resolve(data)
        }).catch(() => {
            reject('查询出错')
        })
    })
}

export const removePoster = (type, data) => {
    return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        const posterDB = db.collection("posters")
        let _p = null
        if (type === 'movie') {
            _p = posterDB.where({
                type
            }).update({
                data: {
                    img: ''
                }
            })
        } else {
            _p = posterDB.doc(data._id).remove()
        }
        _p?.then(res => {
            const data = res.data
            resolve(data)
        }).catch(() => {
            reject('删除出错')
        })
    })
}

export const uploadPoster = (type) => {
    return new Promise((resolve, reject) => {
        wx.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: ["album", "camera"],
            camera: "back",
        }).then((res) => {
            wx.cloud
                .uploadFile({
                    cloudPath: `${new Date().getTime()}.png`, // 上传至云端的路径
                    filePath: res.tempFiles[0].tempFilePath, // 小程序临时文件路径
                })
                .then((res) => {
                    const url = getUrl(res.fileID)
                    const db = wx.cloud.database()
                    const posterDB = db.collection("posters")
                    let p = null
                    if (type === 'movie') {
                        p = posterDB.where({
                            type
                        }).update({
                            data: {
                                img: url
                            }
                        })
                    } else {
                        p = posterDB.add({
                            data: {
                                type: 'activity',
                                img: url
                            }
                        })
                    }
                    p?.then(res => {
                        const data = res.data
                        resolve(data)
                    }).catch(() => {
                        reject('上传出错')
                    })
                })
        })

    })
}