/*
 * fiddle-disclaim: runs a program with macOS "responsibility" disclaimed.
 *
 *   fiddle-disclaim <program> [argument...]
 *
 * macOS charges a process's privacy (TCC) requests, such as the camera, the
 * microphone and screen recording, to its responsible process: the app that
 * started the chain of processes it belongs to. A fiddle that Electron Fiddle
 * starts would therefore use Electron Fiddle's grants. This helper replaces
 * itself with <program> after disclaiming responsibility, so the program is
 * its own responsible process and gets its own grants.
 *
 * The helper does not fork. POSIX_SPAWN_SETEXEC makes posix_spawn behave like
 * exec, so the pid, the open files, the working directory, the environment and
 * the signal state are the ones the caller set up, and the exit status and
 * signals reach the program directly. <program> is a path: there is no PATH
 * search, and its arguments, argv[0] included, are passed on unchanged.
 *
 * Exit codes (the program's own when it runs):
 *    64  usage: no program given (EX_USAGE)
 *    69  this macOS has no disclaim call (EX_UNAVAILABLE); the program is not
 *        run, because it would inherit the caller's privacy grants
 *    71  the spawn could not be set up (EX_OSERR)
 *   126  the program was found but could not be executed
 *   127  the program was not found
 */
#include <dlfcn.h>
#include <errno.h>
#include <spawn.h>
#include <stdio.h>
#include <string.h>
#include <sysexits.h>

/* Like a shell: 126 found but not executable, 127 not found. */
enum { EXIT_NOT_EXECUTABLE = 126, EXIT_NOT_FOUND = 127 };

extern char **environ;

/* Private libSystem API, so it is looked up at run time rather than linked. */
typedef int (*setdisclaim_fn)(posix_spawnattr_t *attr, int disclaim);

int main(int argc, char **argv) {
  if (argc < 2 || argv[1][0] == '\0') {
    fprintf(stderr, "usage: fiddle-disclaim <program> [argument...]\n");
    return EX_USAGE;
  }

  setdisclaim_fn setdisclaim =
      (setdisclaim_fn)dlsym(RTLD_DEFAULT, "responsibility_spawnattrs_setdisclaim");
  if (setdisclaim == NULL) {
    fprintf(stderr,
            "fiddle-disclaim: this macOS cannot disclaim responsibility, so "
            "%s was not started\n",
            argv[1]);
    return EX_UNAVAILABLE;
  }

  posix_spawnattr_t attr;
  int err = posix_spawnattr_init(&attr);
  if (err == 0) err = posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETEXEC);
  if (err == 0) err = setdisclaim(&attr, 1);
  if (err != 0) {
    fprintf(stderr, "fiddle-disclaim: cannot set up the spawn: %s\n", strerror(err));
    return EX_OSERR;
  }

  /* Returns only when the exec failed. */
  err = posix_spawn(NULL, argv[1], NULL, &attr, argv + 1, environ);
  fprintf(stderr, "fiddle-disclaim: cannot run %s: %s\n", argv[1], strerror(err));
  return err == ENOENT || err == ENOTDIR ? EXIT_NOT_FOUND : EXIT_NOT_EXECUTABLE;
}
