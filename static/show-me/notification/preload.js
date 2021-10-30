function notifyMe () {
  const notification = new window.Notification('Hello World', {
    body: 'How is your day?'
  })

  notification.onclick = () => console.log('Clicked')
  notification.onclose = () => console.log('Closed')
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('button').onclick = notifyMe
})
