using MyApp.Services;
using MyApp.Models;
// using MyApp.Fake;
/* using MyApp.AlsoFake; */

namespace MyApp
{
    class Program
    {
        static void Main(string[] args)
        {
            var service = new UserService();
            service.Run();
        }
    }
}
