{
  description = "Dashboards";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = {
    flake-utils,
    nixpkgs,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {inherit system;};
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.act
            pkgs.actionlint
            pkgs.deno
          ];
        };

        # Wrap every CI command as a `nix run .#<name>` app, so they can be
        # invoked the same way locally and in GitHub Actions.
        apps =
          builtins.mapAttrs (name: text: {
            type = "app";
            program = "${pkgs.writeShellApplication {
              inherit name text;
              runtimeInputs = [pkgs.deno];
            }}/bin/${name}";
            meta.description = text;
          }) {
            fmt-check = "deno fmt --check";
            lint = "deno run lint";
            test = "deno run test";
            typecheck = "deno run check";
          };

        formatter = pkgs.alejandra;
      }
    );
}
