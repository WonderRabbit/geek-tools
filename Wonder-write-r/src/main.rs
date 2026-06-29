fn main() {
    let code = match wonder_write_r::cli::run(std::env::args().skip(1), std::env::current_dir()) {
        Ok(code) => code,
        Err(error) => {
            eprintln!(
                "{{\"ok\":false,\"error\":\"cli_failed\",\"message\":{}}}",
                wonder_write_r::cli::json_string(&error.to_string())
            );
            1
        }
    };
    std::process::exit(code);
}
