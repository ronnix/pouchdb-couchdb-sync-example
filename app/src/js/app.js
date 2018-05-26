(function() {

  'use strict';

  var ENTER_KEY = 13;
  var newTodoDom = document.getElementById('new-todo');
  var syncDom = document.getElementById('sync-wrapper');

  // EDITING STARTS HERE (you dont need to edit anything above this line)

  var db = new PouchDB('todos');
  var remoteCouch = 'http://127.0.0.1:5984/todos';

  // Subscribe to DB changes
  db.changes({
    since: 'now',
    live: true
  }).on('change', showTodos);

  // We have to create a new todo document and enter it in the database
  function addTodo(text) {
    var todo = {
      _id: new Date().toISOString(),
      title: text,
      completed: false
    };
    db.put(todo, function callback(err, result) {
      if (!err) {
        console.log('Successfully posted a todo!');
      }
    });
  }

  // Show the current list of todos by reading them from the database
  function showTodos() {
    db.allDocs({include_docs: true, descending: true}, function(err, doc) {
      redrawTodosUI(doc.rows);
    });
  }
  function checkboxChanged(todo, event) {
    todo.completed = event.target.checked;
    db.put(todo);
  }

  // User pressed the delete button for a todo, delete it
  function deleteButtonPressed(todo) {
    db.remove(todo);
  }

  // The input box when editing a todo has blurred, we should save
  // the new title or delete the todo if the title is empty
  function todoBlurred(todo, event) {
    var trimmedText = event.target.value.trim();
    if (!trimmedText) {
      db.remove(todo);
    } else {
      todo.title = trimmedText;
      db.put(todo);
    }
  }

  // Initialise a sync with the remote server
  function sync() {

    var syncHandler = db.sync(remoteCouch, {
      live: true,   // real-time replication
      retry: true,  // reconnect automatically

      // Exponential backoff with a max value
      back_off_function: function (delay) {
        console.log('backoff', delay);
        syncDom.setAttribute('data-sync-state', 'reconnecting');
        if (delay === 0) {
          return 100;
        }
        if (delay >= 3200) {
          return 3200;
        }
        return delay * 2;
      },
    });

    // This event fires when the replication is paused, either because
    // a live replication is waiting for changes, or replication has
    // temporarily failed, with `err`, and is attempting to resume.
    syncHandler.on('paused', function (err) {
      console.log('paused', err);
      syncDom.setAttribute('data-sync-state', 'paused');
    });

    // This event fires when the replication starts actively processing changes;
    // e.g. when it recovers from an error or new changes are available.
    syncHandler.on('active', function (info) {
      console.log('active', info);
      syncDom.setAttribute('data-sync-state', 'active');
    });

    // This event fires when the replication has written a new document.
    //
    // `info` will contain details about the change.
    // `info.docs` will contain the docs involved in that change.
    syncHandler.on('change', function (info) {
      console.log('change', info);
    });

    // This event fires when replication is completed or cancelled.
    // In a live replication, only cancelling the replication should
    // trigger this event.
    //
    // `info` will contain details about the replication.
    syncHandler.on('complete', function (info) {
      console.log('complete', info);
    });

    // This event fires if a document failed to replicate due to validation
    // or authorization errors.
    syncHandler.on('denied', function (err) {
      console.log('denied', err);
    });

    // This event is fired when the replication is stopped due to an
    // unrecoverable failure. If `retry` is `false`, this will also fire
    // when the user goes offline or another network error occurs
    // (so you can handle retries yourself, if you want).
    syncHandler.on('error', function (err) {
      console.log('error', err);
      syncDom.setAttribute('data-sync-state', 'error');
    });
  }

  // User has double clicked a todo, display an input so they can edit the title
  function todoDblClicked(todo) {
    var div = document.getElementById('li_' + todo._id);
    var inputEditTodo = document.getElementById('input_' + todo._id);
    div.className = 'editing';
    inputEditTodo.focus();
  }

  // If they press enter while editing an entry, blur it to trigger save
  // (or delete)
  function todoKeyPressed(todo, event) {
    if (event.keyCode === ENTER_KEY) {
      var inputEditTodo = document.getElementById('input_' + todo._id);
      inputEditTodo.blur();
    }
  }

  // Given an object representing a todo, this will create a list item
  // to display it.
  function createTodoListItem(todo) {
    var checkbox = document.createElement('input');
    checkbox.className = 'toggle';
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', checkboxChanged.bind(this, todo));

    var label = document.createElement('label');
    label.appendChild( document.createTextNode(todo.title));
    label.addEventListener('dblclick', todoDblClicked.bind(this, todo));

    var deleteLink = document.createElement('button');
    deleteLink.className = 'destroy';
    deleteLink.addEventListener( 'click', deleteButtonPressed.bind(this, todo));

    var divDisplay = document.createElement('div');
    divDisplay.className = 'view';
    divDisplay.appendChild(checkbox);
    divDisplay.appendChild(label);
    divDisplay.appendChild(deleteLink);

    var inputEditTodo = document.createElement('input');
    inputEditTodo.id = 'input_' + todo._id;
    inputEditTodo.className = 'edit';
    inputEditTodo.value = todo.title;
    inputEditTodo.addEventListener('keypress', todoKeyPressed.bind(this, todo));
    inputEditTodo.addEventListener('blur', todoBlurred.bind(this, todo));

    var li = document.createElement('li');
    li.id = 'li_' + todo._id;
    li.appendChild(divDisplay);
    li.appendChild(inputEditTodo);

    if (todo.completed) {
      li.className += 'complete';
      checkbox.checked = true;
    }

    return li;
  }

  function redrawTodosUI(todos) {
    var ul = document.getElementById('todo-list');
    ul.innerHTML = '';
    todos.forEach(function(todo) {
      ul.appendChild(createTodoListItem(todo.doc));
    });
  }

  function newTodoKeyPressHandler( event ) {
    if (event.keyCode === ENTER_KEY) {
      addTodo(newTodoDom.value);
      newTodoDom.value = '';
    }
  }

  function addEventListeners() {
    newTodoDom.addEventListener('keypress', newTodoKeyPressHandler, false);
  }

  addEventListeners();
  showTodos();

  if (remoteCouch) {
    sync();
  }

})();
