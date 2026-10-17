/*
 * selfcheck: proves that fiddle-disclaim disclaims responsibility, and that
 * it is otherwise transparent, on the macOS it runs on.
 *
 *   ./selfcheck <path to fiddle-disclaim>
 *
 * Exits 0 when every check passes, 1 when one fails, 2 when it cannot check.
 */
#include <dlfcn.h>
#include <errno.h>
#include <signal.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

/* Private libSystem API, so it is looked up at run time rather than linked. */
static pid_t (*responsible_for)(pid_t);

static int failures;

static void check(int ok, const char *what) {
  printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) failures++;
}

static int fatal(const char *what) {
  fprintf(stderr, "selfcheck: %s\n", what);
  return 2;
}

/* The program side: the copies the check starts. */
static int child_main(int argc, char **argv) {
  const char *mode = argv[1];
  if (strcmp(mode, "--exit") == 0 && argc > 2) return atoi(argv[2]);
  const char *marker = getenv("FIDDLE_SELFCHECK_MARKER");
  printf("pid=%d responsible=%d marker=%s args=", (int)getpid(),
         (int)responsible_for(getpid()), marker ? marker : "-");
  for (int i = 2; i < argc; i++) printf("[%s]", argv[i]);
  printf("\n");
  fflush(stdout);
  if (strcmp(mode, "--wait") == 0) sleep(30);
  return 0;
}

/* Starts argv with its stdout on a pipe; returns the pid and the read end. */
static pid_t start(char *const argv[], int *read_fd) {
  int fds[2];
  if (pipe(fds) != 0) exit(fatal("pipe failed"));
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  posix_spawn_file_actions_adddup2(&actions, fds[1], STDOUT_FILENO);
  posix_spawn_file_actions_addclose(&actions, fds[0]);
  posix_spawn_file_actions_addclose(&actions, fds[1]);
  pid_t pid;
  int err = posix_spawn(&pid, argv[0], &actions, NULL, argv, environ);
  posix_spawn_file_actions_destroy(&actions);
  close(fds[1]);
  if (err != 0) {
    fprintf(stderr, "selfcheck: cannot start %s: %s\n", argv[0], strerror(err));
    exit(2);
  }
  *read_fd = fds[0];
  return pid;
}

/* One line of the child's output, without the newline. */
static void read_line(int fd, char *line, size_t size) {
  size_t n = 0;
  char c;
  while (n + 1 < size && read(fd, &c, 1) == 1 && c != '\n') line[n++] = c;
  line[n] = '\0';
}

static int wait_status(pid_t pid) {
  int status = 0;
  waitpid(pid, &status, 0);
  return status;
}

struct report {
  int pid;
  int responsible;
  char rest[256];
};

/* Runs argv, which prints a report line, and waits for it. */
static struct report run_report(char *const argv[], pid_t *spawned) {
  int fd;
  *spawned = start(argv, &fd);
  char line[512];
  read_line(fd, line, sizeof line);
  close(fd);
  wait_status(*spawned);
  struct report r = {-1, -1, ""};
  sscanf(line, "pid=%d responsible=%d %255[^\n]", &r.pid, &r.responsible, r.rest);
  return r;
}

int main(int argc, char **argv) {
  responsible_for = (pid_t (*)(pid_t))dlsym(RTLD_DEFAULT,
                                            "responsibility_get_pid_responsible_for_pid");
  if (responsible_for == NULL) return fatal("this macOS cannot tell who is responsible");
  if (argc > 1 && strncmp(argv[1], "--", 2) == 0) return child_main(argc, argv);
  if (argc != 2) return fatal("usage: selfcheck <path to fiddle-disclaim>");

  char *self = argv[0];
  char *helper = argv[1];
  char marker[64];
  snprintf(marker, sizeof marker, "FIDDLE_SELFCHECK_MARKER=%d", (int)getpid());
  if (putenv(marker) != 0) return fatal("putenv failed");
  char expected[512];
  snprintf(expected, sizeof expected, "marker=%d args=[one][two words]", (int)getpid());

  pid_t spawned;
  char *direct[] = {self, "--report", "one", "two words", NULL};
  struct report control = run_report(direct, &spawned);
  check(control.responsible == (int)responsible_for(getpid()) &&
            control.responsible != control.pid,
        "a program started directly shares this process's responsibility");

  char *through[] = {helper, self, "--report", "one", "two words", NULL};
  struct report r = run_report(through, &spawned);
  check(r.responsible == r.pid && r.pid > 0, "through the helper, it is its own responsible process");
  check(r.pid == (int)spawned, "the helper's pid becomes the program's pid");
  check(strcmp(r.rest, expected) == 0, "arguments and environment arrive unchanged");

  char *exits[] = {helper, self, "--exit", "42", NULL};
  int fd;
  pid_t pid = start(exits, &fd);
  close(fd);
  int status = wait_status(pid);
  check(WIFEXITED(status) && WEXITSTATUS(status) == 42, "the program's exit status is the caller's");

  char *waits[] = {helper, self, "--wait", NULL};
  pid = start(waits, &fd);
  char line[512];
  read_line(fd, line, sizeof line);
  close(fd);
  kill(pid, SIGTERM);
  status = wait_status(pid);
  check(WIFSIGNALED(status) && WTERMSIG(status) == SIGTERM, "signals reach the program");

  char *none[] = {helper, NULL};
  pid = start(none, &fd);
  close(fd);
  status = wait_status(pid);
  check(WIFEXITED(status) && WEXITSTATUS(status) == 64, "no program: exit 64");

  char *missing[] = {helper, "/no/such/program", NULL};
  pid = start(missing, &fd);
  close(fd);
  status = wait_status(pid);
  check(WIFEXITED(status) && WEXITSTATUS(status) == 127, "a missing program: exit 127");

  return failures == 0 ? 0 : 1;
}
