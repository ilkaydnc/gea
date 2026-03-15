let counter = Math.floor(Math.random() * 2147483648)

const getUid = (): string => (counter++).toString(36)

export default getUid
